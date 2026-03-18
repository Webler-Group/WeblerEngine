/**
 * Factory is a design pattern providing a method for creating objects
 * without specifying their classes.
 *
 * @typedef {(params: Record<string, any>) => Scene} SceneFactory
 */



/**
 * 1st core class
 * Scene manager holds on all scenes in a registry of scene factories.
 * Responsible for managing the current scene and scene switching.
 */
class SceneManager {
    /**
     * @type {Map<string, SceneFactory>} 
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
     * Registers new scene factory.
     * 
     * @param {string} name 
     * @param {SceneFactory} factory 
     */
    register(name, factory) {
        this.registry.set(name, factory);
    }

    /**
     * Forwards dt to the current scene. No-op if there is no active scene.
     *
     * @param {number} dt
     */
    update(dt) {
        if (this.currentScene) {
            this.currentScene.update(dt);
        }
    }

    /**
     * Changes the current scene by destroying the
     *
     * @param {string} name
     * @param {Record<string, any>} params
     */
    switchScene(name, params) {
        const factory = this.registry.get(name);
        if (!factory) {
            throw new Error(`SceneManager: Unknown scene "${name}"`);
        }

        if (this.currentScene) {
            this.currentScene.destroy();
        }

        const scene = factory(params);
        scene.start();

        this.currentScene = scene;
    }
}

/**
 * 2nd core class
 * Every scene must extend from this class. This is container for scene nodes.
 * 
 * @abstract
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
     * Returns the first node whose `name` matches, searching both live nodes
     * and those still in `pending`. Returns `null` if not found.
     *
     * @param {string} name
     * @returns {SceneNode | null}
     */
    findNode(name) {
        for (const node of this.nodes) {
            if (node.name === name) return node;
        }
        for (const node of this.pending) {
            if (node.name === name) return node;
        }
        return null;
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

    constructor() {
        this.id = SceneNode._nextId++;
        this.name = `node_${this.id}`;
        this.scene = null;
    }

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
        
    }
}