/**
 * @typedef {(scene: Scene, params: Record<string, any>) => void} SceneInit
 */

/**
 * @typedef {{ type: string, data: any, target: SceneNode }} SceneNodeEvent
 */

/**
 * 1st core class. Owns the active scene and handles transitions between scenes.
 *
 * Scenes are defined by registering an init function — a plain function that
 * receives a fresh Scene and populates it with nodes. SceneManager creates the
 * Scene object internally; callers never instantiate or extend Scene directly.
 *
 *   sm.register('game', (scene, params) => {
 *     scene.addNode(new Player());
 *     scene.addNode(new Level(params.level));
 *   });
 *   sm.switchScene('game', { level: 1 });
 */
class SceneManager {
    /**
     * @type {Map<string, SceneInit>}
     */
    registry;
    /**
     * @type {Scene | null}
     */
    currentScene;

    constructor() {
        this.registry = new Map();
        this.currentScene = null;
    }

    /**
     * Registers an init function under a name. The init function is called by
     * switchScene() with a fresh Scene and any params passed at switch time.
     * Use it to add starting nodes to the scene via scene.addNode().
     *
     * @param {string} name
     * @param {SceneInit} init
     */
    register(name, init) {
        this.registry.set(name, init);
    }

    /**
     * Updates current scene
     * 
     * @param {number} dt
     */
    update(dt) {
        if (this.currentScene) {
            this.currentScene.update(dt);
        }
    }

    /**
     * Destroys current scene then initializes and starts new scene
     * 
     * @param {string} name
     * @param {Record<string, any>} params
     */
    switchScene(name, params = {}) {
        const init = this.registry.get(name);
        if (!init) {
            throw new Error(`SceneManager: Unknown scene "${name}"`);
        }

        if (this.currentScene) {
            this.currentScene.destroy();
        }

        const scene = new Scene();
        init(scene, params);
        scene.start();

        this.currentScene = scene;
    }
}

/**
 * 2nd core class. A pure container for SceneNodes.
 *
 * Scene is created and managed entirely by SceneManager — callers never
 * instantiate or extend it. To set up a scene, register an init function
 * with SceneManager.register(); that function receives a fresh Scene and
 * adds the starting nodes with addNode().
 *
 * Rules:
 *   - Do NOT subclass Scene.
 *   - Do NOT construct Scene directly (new Scene()).
 *   - Do NOT add custom properties to a Scene instance.
 *   - Scene is only a container; all game logic belongs in SceneNodes.
 */
class Scene {
    /**
     * @type {SceneNode[]}
     */
    nodes;
    /**
     * @type {SceneNode[]}
     *
     * Nodes are staged here instead of pushed directly into `nodes`.
     * This matters because `addNode` can be called at any point — including
     * from inside another node's `update`. Mutating `nodes` while it is
     * being iterated causes nodes to be updated on the same frame they were
     * added (or skipped entirely), leading to subtle, hard-to-reproduce bugs.
     * Flushing `pending` at the top of each `update` tick keeps the live
     * array stable during iteration and gives every new node a clean first
     * frame starting on the *next* tick.
     */
    pending;
    /**
     * @type {SceneNode[]}
     *
     * Same reasoning as `pending`: splicing `nodes` mid-iteration shifts
     * indices and can cause nodes to be skipped or double-updated in the
     * same frame. Nodes queued here are destroyed and removed from `nodes`
     * at the top of the next tick, after the previous iteration has fully
     * completed.
     */
    pendingRemoval;
    /**
     * @type {boolean}
     */
    running;

    constructor() {
        this.nodes = [];
        this.pending = [];
        this.pendingRemoval = [];
        this.running = false;
    }

    /**
     * Adds a node to the scene. Assigns `node.scene` so the node can
     * reference its owning scene (e.g. to add/remove siblings).
     *
     * If the scene is not yet running, the node goes straight into `nodes` —
     * there is no active update loop to interfere with, so staging is
     * unnecessary. If the scene is already running the node is staged in
     * `pending` and flushed at the top of the next tick to avoid mutating
     * `nodes` while it is being iterated.
     *
     * @param {SceneNode} node
     */
    addNode(node) {
        node.scene = this;

        if (this.running) {
            this.pending.push(node);
        } else {
            this.nodes.push(node);
            node.start();
        }
    }

    /**
     * Removes a node from the scene.
     *
     * If the scene is running, the node is staged in `pendingRemoval` and
     * destroyed at the top of the next tick — splicing `nodes` mid-iteration
     * shifts indices and can cause sibling nodes to be skipped or
     * double-updated in the same frame.
     *
     * If the scene is not running there is no active iteration, so the node
     * is removed immediately. A node still in `pending` (added but not yet
     * flushed) is always removed immediately regardless of running state,
     * since it has never entered the live array.
     *
     * @param {SceneNode} node
     */
    removeNode(node) {
        const pendingIdx = this.pending.indexOf(node);
        if (pendingIdx !== -1) {
            this.pending.splice(pendingIdx, 1);
            node.destroy();
            node.scene = null;
            return;
        }

        if (this.running) {
            this.pendingRemoval.push(node);
        } else {
            const idx = this.nodes.indexOf(node);
            if (idx !== -1) {
                this.nodes.splice(idx, 1);
                node.destroy();
                node.scene = null;
            }
        }
    }

    /**
     * Returns the first node whose `name` matches. Returns `null` if not found.
     *
     * @param {string} name
     * @returns {SceneNode | null}
     */
    findNode(name) {
        for (const node of this.nodes) {
            if (node.name === name) return node;
        }
        return null;
    }

    /**
     * Returns all nodes that are instances of the given class.
     * Pass any class that extends SceneNode.
     *
     * @template {typeof SceneNode} T
     * @param {T} type
     * @returns {InstanceType<T>[]}
     */
    findNodesByType(type) {
        return /** @type {InstanceType<T>[]} */ (this.nodes.filter(n => n instanceof type));
    }

    /**
     * Called automatically before the start of its life cycle.
     */
    start() {
        this.running = true;
    }

    /**
     * Called automatically every frame while it is alive.
     *
     * @param {number} dt
     */
    update(dt) {
        // Flush removals first so destroyed nodes are never iterated.
        if (this.pendingRemoval.length > 0) {
            for (const node of this.pendingRemoval) {
                const idx = this.nodes.indexOf(node);
                if (idx !== -1) this.nodes.splice(idx, 1);
                node.destroy();
                node.scene = null;
            }
            this.pendingRemoval = [];
        }

        // Flush pending additions after removals. `start` is called here —
        // when the node becomes live — so it is already in `nodes` and fully
        // reachable if `start` calls `addNode` or `removeNode`.
        if (this.pending.length > 0) {
            for (const node of this.pending) {
                this.nodes.push(node);
                node.start();
            }
            this.pending = [];
        }

        for (const node of this.nodes) {
            node.update(dt);
        }
    }

    /**
     * Called automatically before the end of its life cycle.
     */
    destroy() { 
        this.running = false;
    }
}

/**
 * 3rd core class
 * Building block of scene.
 */
class SceneNode {
    static _nextId = 0;

    /**
     * @type {number}
     */
    id;
    /**
     * @type {string}
     */
    name;
    /**
     * @type {Scene | null}
     */
    scene;
    /**
     * Local position.
     * @type {Vector}
     */
    position;
    /**
     * Local rotation in radians.
     * @type {number}
     */
    angle;
    /**
     * Local scale.
     * @type {Vector}
     */
    scale;
    /**
     * @type {SceneNode | null}
     */
    parent;
    /**
     * @type {Map<string, Set<Function>>}
     */
    _listeners;

    constructor() {
        this.id = SceneNode._nextId++;
        this.name = `node_${this.id}`;
        this.scene = null;
        this.position = Vector.zero();
        this.angle = 0;
        this.scale = Vector.one();
        this.parent = null;
        this._listeners = new Map();
    }

    /**
     * Sets the parent of this node. When `keepWorldPosition` is true the
     * local transform is recalculated so the node stays at its current world
     * position / angle / scale after reparenting.
     *
     * @param {SceneNode | null} node
     * @param {boolean} keepWorldPosition
     */
    setParent(node, keepWorldPosition = false) {
        if (keepWorldPosition) {
            const wp = this.getWorldPosition();
            const wa = this.getWorldAngle();
            const ws = this.getWorldScale();
            this.parent = node;
            this.setWorldPosition(wp);
            this.setWorldAngle(wa);
            this.setWorldScale(ws);
        } else {
            this.parent = node;
        }
    }

    // -------------------------------------------------------------------------
    // World position
    // -------------------------------------------------------------------------

    /**
     * Returns the world-space position of this node as a Vector.
     * `angle` is treated as radians.
     *
     * @returns {Vector}
     */
    getWorldPosition() {
        if (!this.parent) return this.position.clone();
        const p = this.parent.getWorldPosition();
        const pa = this.parent.getWorldAngle();
        const ps = this.parent.getWorldScale();
        return p.add(this.position.clone().mul(ps).rotate(pa));
    }

    /**
     * @param {Vector} w
     */
    setWorldPosition(w) {
        if (!this.parent) {
            this.position.set(w.x, w.y);
            return;
        }
        const p = this.parent.getWorldPosition();
        const pa = this.parent.getWorldAngle();
        const ps = this.parent.getWorldScale();
        this.position.copy(w.sub(p).rotate(-pa).div(ps));
    }

    /**
     * @param {number} wx
     */
    setWorldPositionX(wx) {
        this.setWorldPosition(new Vector(wx, this.getWorldPosition().y));
    }

    /**
     * @param {number} wy
     */
    setWorldPositionY(wy) {
        this.setWorldPosition(new Vector(this.getWorldPosition().x, wy));
    }

    // -------------------------------------------------------------------------
    // World angle (radians)
    // -------------------------------------------------------------------------

    /**
     * Returns the world-space angle of this node in radians.
     *
     * @returns {number}
     */
    getWorldAngle() {
        if (!this.parent) return this.angle;
        return this.parent.getWorldAngle() + this.angle;
    }

    /**
     * @param {number} wa
     */
    setWorldAngle(wa) {
        this.angle = this.parent ? wa - this.parent.getWorldAngle() : wa;
    }

    // -------------------------------------------------------------------------
    // World scale
    // -------------------------------------------------------------------------

    /**
     * Returns the world-space scale of this node as a Vector.
     *
     * @returns {Vector}
     */
    getWorldScale() {
        if (!this.parent) return this.scale.clone();
        return this.parent.getWorldScale().mul(this.scale);
    }

    /**
     * @param {Vector} ws
     */
    setWorldScale(ws) {
        this.scale.copy(this.parent ? ws.clone().div(this.parent.getWorldScale()) : ws.clone());
    }

    /**
     * @param {number} wsx
     */
    setWorldScaleX(wsx) {
        this.setWorldScale(new Vector(wsx, this.getWorldScale().y));
    }

    /**
     * @param {number} wsy
     */
    setWorldScaleY(wsy) {
        this.setWorldScale(new Vector(this.getWorldScale().x, wsy));
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /**
     * Registers a listener for the given event type. The handler is called
     * with a SceneNodeEvent every time emit() is called with that type.
     *
     * @param {string} type
     * @param {(event: SceneNodeEvent) => void} handler
     */
    on(type, handler) {
        if (!this._listeners.has(type)) {
            this._listeners.set(type, new Set());
        }
        this._listeners.get(type).add(handler);
    }

    /**
     * Like on(), but the handler automatically removes itself after the
     * first time it is called.
     *
     * @param {string} type
     * @param {(event: SceneNodeEvent) => void} handler
     */
    once(type, handler) {
        const wrapper = (event) => {
            this.off(type, wrapper);
            handler(event);
        };
        this.on(type, wrapper);
    }

    /**
     * Removes a previously registered listener. Does nothing if the handler
     * was not registered for that type.
     *
     * @param {string} type
     * @param {(event: SceneNodeEvent) => void} handler
     */
    off(type, handler) {
        this._listeners.get(type)?.delete(handler);
    }

    /**
     * Dispatches an event on this node. All listeners registered for the
     * given type are called synchronously in registration order.
     *
     * @param {string} type
     * @param {any} [data]
     */
    emit(type, data) {
        const listeners = this._listeners.get(type);
        if (!listeners) return;
        const event = { type, data, target: this };
        for (const handler of [...listeners]) {
            handler(event);
        }
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Called automatically before the start of its life cycle.
     * Use to allocated external resources.
     */
    start() {

    }

    /**
     * Called automatically every frame while it is alive.
     *
     * @param {number} dt
     */
    update(dt) {

    }

    /**
     * Called automatically before the end of its life cycle.
     * All resources allocated outside of the node shall be cleaned up.
     */
    destroy() {
        this._listeners.clear();
    }
}