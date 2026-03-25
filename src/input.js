/**
 * @typedef {{ pressed: boolean, value: any }} ControlState
 */

/**
 * @typedef {{ device: string, control: string }} ControlInfo
 */

/**
 * @typedef {{ action: string, source: ControlInfo, required: ControlInfo[] }} ActionBinding
 */

/**
 * @typedef {"start" | "change" | "end"} DeviceEventType 
 */

/**
 * @typedef {{ type: DeviceEventType, value: any } & ControlInfo} DeviceEvent
 */

/**
 * @typedef {(value: any) => void} ActionListener
 */

class InputManager {
    /**
     * @type {Map<string, ControlState>}
     */
    _controlStates;
    /**
     * @type {Map<string, ActionBinding[]>}
     */
    _controlToBindings;
    /**
     * @type {Map<string, { active: boolean, value: any }>}
     */
    _actions;
    /**
     * @type {Map<string, Set<ActionListener>>}
     */
    _actionListeners;
    /**
     * @type {Map<string, InputDevice>}
     */
    _devices;

    /**
     * @param {{ keyboard?: boolean, pointer?: HTMLCanvasElement }} config
     */
    constructor(config = {}) {
        this._controlStates = new Map();
        this._controlToBindings = new Map();
        this._actions = new Map();
        this._actionListeners = new Map();
        this._devices = new Map();

        if (config.keyboard) {
            this._addDevice(new KeyboardDevice(this));
        }
        if (config.pointer) {
            this._addDevice(new PointerDevice(this, config.pointer));
        }
    }

    /**
     * @param {InputDevice} device
     */
    _addDevice(device) {
        this._devices.set(device.name, device);
    }

    /**
     * @param {string} name
     * @returns {InputDevice | undefined}
     */
    getDevice(name) {
        return this._devices.get(name);
    }

    /**
     * @param {string} action
     * @param {"start" | "change" | "end"} type
     * @param {ActionListener} listener
     */
    onAction(action, type, listener) {
        const key = `${action}:${type}`;
        if (!this._actionListeners.has(key)) {
            this._actionListeners.set(key, new Set());
        }
        this._actionListeners.get(key).add(listener);
    }

    /**
     * @param {string} action
     * @param {"start" | "change" | "end"} type
     * @param {ActionListener} listener
     */
    offAction(action, type, listener) {
        this._actionListeners.get(`${action}:${type}`)?.delete(listener);
    }

    /**
     * @param {string} action
     * @param {"start" | "change" | "end"} type
     * @param {any} value
     */
    _emitAction(action, type, value) {
        const listeners = this._actionListeners.get(`${action}:${type}`);
        if (!listeners) return;
        for (const listener of listeners) {
            listener(value);
        }
    }

    /**
     * 
     * @param {string} action 
     * @param {ControlInfo} source 
     * @param {ControlInfo[]} required 
     */
    addBinding(action, source, required = []) {
        const binding = { action, source, required };
        const controls = [...required, source];

        if (!this._actions.has(action)) {
            this._actions.set(action, { active: false });
        }

        for (const info of controls) {
            const key = this._getControlKey(info);
            if (!this._controlToBindings.has(key)) {
                this._controlToBindings.set(key, []);
            }
            this._controlToBindings.get(key).push(binding);
        }
    }

    /**
     * 
     * @param {DeviceEvent} event 
     */
    handleDeviceEvent(event) {
        const key = this._getControlKey(event);
        if (!this._controlStates.has(key)) {
            this._controlStates.set(key, { pressed: false });
        }

        const state = this._controlStates.get(key);
        switch (event.type) {
            case "start":
                state.pressed = true;
                state.value = event.value;
                break;
            case "change":
                state.value = event.value;
                break;
            case "end":
                state.pressed = false;
                break;
        }

        const bindings = this._controlToBindings.get(key);

        if (!bindings) return;

        for (const binding of bindings) {
            if (key !== this._getControlKey(binding.source)) continue;

            const sourceState = this._controlStates.get(key);
            const isActive = sourceState?.pressed && 
                binding.required.every((controlInfo) => this._isControlPressed(controlInfo));

            const action = this._actions.get(binding.action);
            if (!action) continue;

            const wasActive = action.active;
            action.active = isActive;

            if (isActive) {
                action.value = sourceState?.value;
            }

            if (!wasActive && isActive) {
                this._emitAction(binding.action, "start", action.value);
            } else if (wasActive && isActive) {
                this._emitAction(binding.action, "change", action.value);
            } else if (wasActive && !isActive) {
                this._emitAction(binding.action, "end");
            }
        }
    }

    /**
     * 
     * @param {ControlInfo} controlInfo 
     * @returns {boolean}
     */
    _isControlPressed(controlInfo) {
        const state = this._controlStates.get(this._getControlKey(controlInfo));
        return state?.pressed === true;
    }

    /**
     * 
     * @param {ControlInfo} controlInfo
     * @returns {string}
     */
    _getControlKey(controlInfo) {
        return `${controlInfo.device}:${controlInfo.control}`;
    }
}

class InputDevice {
    /**
     * @type {InputManager}
     */
    manager;
    /**
     * @type {string}
     */
    name;
    /**
     * @type {Set<InputControl>}
     */
    _controls;

    /**
     * 
     * @param {InputManager} manager 
     * @param {string} name 
     */
    constructor(manager, name) {
        this.manager = manager;
        this.name = name;

        this._controls = new Set();
    }

    /**
     * 
     * @param {InputControl} control 
     */
    registerControl(control) {
        this._controls.add(control);
    }

    /**
     * 
     * @param {InputControl} control 
     */
    unregisterControl(control) {
        this._controls.delete(control);
    }

    /**
     * 
     * @param {string} control 
     * @param {DeviceEventType} type 
     * @param {any} value 
     */
    emitDeviceEvent(control, type, value) {
        this.manager.handleDeviceEvent({ device: this.name, control, type, value });
    }
}

class KeyboardDevice extends InputDevice {
    /**
     * 
     * @param {InputManager} manager 
     */
    constructor(manager) {
        super(manager, "keyboard");

        window.addEventListener("keydown", (e) => this._handleKeyboardEvent(e, "start"));
        window.addEventListener("keyup", (e) => this._handleKeyboardEvent(e, "end"));
    }

    /**
     * 
     * @param {KeyboardEvent} e 
     * @param {DeviceEventType} deviceEventType 
     */
    _handleKeyboardEvent(e, deviceEventType) {
        if (e.repeat) return;

        this.emitDeviceEvent(e.code, deviceEventType, null);

        for (let control of this._controls) {
            control.handleKey(e.code, deviceEventType === "start");
        }
    }
}

class PointerDevice extends InputDevice {
    /**
     * @type {HTMLElement}
     */
    element;
    /**
     * @type {Map<number, InputControl>}
     */
    _pointerOwners;

    /**
     * 
     * @param {InputManager} manager 
     * @param {HTMLElement} element 
     */
    constructor(manager, element) {
        super(manager, "pointer");

        this.element = element;
        this._pointerOwners = new Map();

        this.element.style.touchAction = "none";

        this.element.addEventListener("pointerdown", (e) => this._handlePointerEvent(e, "start"));
        this.element.addEventListener("pointermove", (e) => this._handlePointerEvent(e, "change"));
        this.element.addEventListener("pointerup", (e) => this._handlePointerEvent(e, "end"));
        this.element.addEventListener("pointercancel", (e) => this._handlePointerEvent(e, "end"));
    }

    /**
     * 
     * @param {PointerEvent} e 
     * @param {DeviceEventType} deviceEventType 
     */
    _handlePointerEvent(e, deviceEventType) {
        const rect = this.element.getBoundingClientRect();

        const position = new Vector(
            (e.clientX - rect.left) / rect.width,
            (e.clientY - rect.top) / rect.height
        );

        if (deviceEventType === "start") {
            this.element.setPointerCapture(e.pointerId);
        }

        const owner = this._pointerOwners.get(e.pointerId);

        if (deviceEventType !== "start") {
            if (owner) {
                owner.handlePointer(deviceEventType, e.pointerId, position);
                if (deviceEventType === "end") {
                    this._pointerOwners.delete(e.pointerId);
                }
            }
            return;
        }

        const sorted = [...this._controls].sort((a, b) => b.priority - a.priority);

        for (const control of sorted) {
            const claimed = control.handlePointer("start", e.pointerId, position);
            if (claimed) {
                this._pointerOwners.set(e.pointerId, control);
                break;
            }
        }
    }
}

class InputControl extends SceneNode {
    /**
     * @type {InputDevice}
     */
    device;

    /**
     * 
     * @param {InputDevice} device 
     */
    constructor(device) {
        super();

        this.device = device;
    }

    start() {
        this.device.registerControl(this);
    }

    destroy() {
        super.destroy();
        this.device.unregisterControl(this);
    }

    /**
     * 
     * @param {DeviceEventType} type 
     * @param {any} value 
     */
    emitDeviceEvent(type, value) {
        this.device.emitDeviceEvent(this.name, type, value);
    }

    /**
     * 
     * @param {DeviceEventType} eventType 
     * @param {number} id 
     * @param {Vector} position 
     * @returns {boolean}
     */
    handlePointer(eventType, id, position) {
        return false;
    }

    /**
     * 
     * @param {string} code 
     * @param {boolean} down 
     */
    handleKey(code, down) { }
}

/**
 * @typedef {{ priority?: number }} PointerControlParams
 */

class PointerControl extends InputControl {
    /**
     * @type {number | null}
     */
    pointerId;
    /**
     * @type {number}
     */
    priority;

    /**
     * 
     * @param {PointerDevice} pointerDevice 
     * @param {PointerControlParams} params 
     */
    constructor(pointerDevice, params = {}) {
        super(pointerDevice);

        this.priority = params.priority ?? 0;
        this.pointerId = null;
    }

    /**
     * 
     * @param {DeviceEventType} eventType 
     * @param {number} id 
     * @param {Vector} position 
     * @returns {boolean}
     */
    handlePointer(eventType, id, pos) {

        if (eventType === "start") {
            if (this.pointerId !== null) return false;

            const claimed = this.onPointerStart(pos);
            if (claimed) {
                this.pointerId = id;
            }
            return claimed;
        }

        if (this.pointerId !== id) return false;

        if (eventType === "change") {
            this.onPointerMove(pos);
        }

        if (eventType === "end") {
            this.onPointerEnd();
            this.pointerId = null;
        }

        return true;
    }

    /**
     * 
     * @param {Vector} pos 
     * @returns {boolean}
     */
    onPointerStart(pos) {
        return false;
    }

    /**
     * 
     * @param {Vector} position 
     */
    onPointerMove(position) { }

    onPointerEnd() { }
}

/**
 * @typedef {{ camera?: Camera | null } & PointerControlParams} PointerPositionParams
 */

class PointerPosition extends PointerControl {
    /**
     * @type {Vector}
     */
    posVector;
    /**
     * @type {Camera | null}
     */
    camera;

    /**
     * @param {PointerDevice} pointerDevice
     * @param {PointerPositionParams} params
     */
    constructor(pointerDevice, params = {}) {
        super(pointerDevice, params);

        this.posVector = new Vector(0, 0);
        this.camera = params.camera ?? null;
    }

    /**
     * @param {Vector} pos
     * @returns {Vector}
     */
    _toWorld(pos) {
        return this.camera ? this.camera.screenToWorld(pos.x, pos.y) : pos;
    }

    /**
     * @param {Vector} pos
     * @returns {boolean}
     */
    onPointerStart(pos) {
        this.posVector.copy(this._toWorld(pos));
        this.emitDeviceEvent("start", this.posVector);
        this.emitDeviceEvent("change", this.posVector);
        return true;
    }

    /**
     * @param {Vector} pos
     */
    onPointerMove(pos) {
        this.posVector.copy(this._toWorld(pos));
        this.emitDeviceEvent("change", this.posVector);
    }

    onPointerEnd() {
        this.emitDeviceEvent("end");
    }
}

/**
 * @typedef {{ canvas: HTMLCanvasElement, shape?: "rect" | "circle", width?: number, height?: number, radius?: number } & PointerControlParams} ButtonParams
 */

/**
 * A PointerControl that represents a pressable button in screen space.
 *
 * The button is centered at the node's world position (in canvas pixels).
 * Shape can be "rect" (default) or "circle". Hit-testing converts the
 * normalised pointer position to canvas pixels before comparing.
 *
 * Add a ButtonDrawable as a child node to visualise it.
 */
class Button extends PointerControl {
    /**
     * @type {HTMLCanvasElement}
     */
    canvas;
    /**
     * Hit-test shape.
     * @type {"rect" | "circle"}
     */
    shape;
    /**
     * Width in canvas pixels (rect only).
     * @type {number}
     */
    width;
    /**
     * Height in canvas pixels (rect only).
     * @type {number}
     */
    height;
    /**
     * Radius in canvas pixels (circle only).
     * @type {number}
     */
    radius;
    /**
     * True while the button is held down.
     * @type {boolean}
     */
    pressed;

    /**
     * @param {PointerDevice} pointerDevice
     * @param {ButtonParams} params
     */
    constructor(pointerDevice, params = {}) {
        super(pointerDevice, params);
        this.canvas = params.canvas;
        this.shape = params.shape ?? "rect";
        this.width = params.width ?? 0;
        this.height = params.height ?? 0;
        this.radius = params.radius ?? 0;
        this.pressed = false;
    }

    /**
     * @param {Vector} pos  Normalised pointer position (0–1).
     * @returns {boolean}
     */
    _hitTest(pos) {
        const px = pos.x * this.canvas.width;
        const py = pos.y * this.canvas.height;
        const c = this.getWorldPosition();
        const dx = px - c.x;
        const dy = py - c.y;
        if (this.shape === "circle") {
            return dx * dx + dy * dy <= this.radius * this.radius;
        }
        return Math.abs(dx) <= this.width / 2 && Math.abs(dy) <= this.height / 2;
    }

    /**
     * @param {Vector} pos
     * @returns {boolean}
     */
    onPointerStart(pos) {
        if (!this._hitTest(pos)) return false;
        this.pressed = true;
        this.emitDeviceEvent("start", true);
        return true;
    }

    onPointerEnd() {
        this.pressed = false;
        this.emitDeviceEvent("end", false);
    }
}

/**
 * @typedef {{ canvas: HTMLCanvasElement, radius?: number } & PointerControlParams} PointerJoystickParams
 */

/**
 * A PointerControl that acts as a virtual joystick in screen space.
 *
 * The joystick zone is a circle centered at the node's world position (canvas
 * pixels). When a pointer lands inside the zone, the joystick becomes active.
 * The stick offset from the center is clamped to `radius` and normalised to
 * produce the `action` vector.
 *
 * Add a JoystickDrawable as a child node to visualise it.
 */
class PointerJoystick extends PointerControl {
    /**
     * @type {HTMLCanvasElement}
     */
    canvas;
    /**
     * Outer radius of the joystick zone in canvas pixels.
     * @type {number}
     */
    radius;
    /**
     * True while a pointer is active on this joystick.
     * @type {boolean}
     */
    pressed;
    /**
     * Normalised direction vector in the range [-1, 1] on each axis.
     * Zero vector when the joystick is not active.
     * @type {Vector}
     */
    action;

    /**
     * @param {PointerDevice} pointerDevice
     * @param {PointerJoystickParams} params
     */
    constructor(pointerDevice, params = {}) {
        super(pointerDevice, params);
        this.canvas = params.canvas;
        this.radius = params.radius ?? 60;
        this.pressed = false;
        this.action = new Vector(0, 0);
    }

    /**
     * @param {Vector} pos  Normalised pointer position (0–1).
     * @returns {Vector}    Position in canvas pixels.
     */
    _toPixels(pos) {
        return new Vector(pos.x * this.canvas.width, pos.y * this.canvas.height);
    }

    /**
     * @param {Vector} pos
     * @returns {boolean}
     */
    _hitTest(pos) {
        const px = this._toPixels(pos);
        const c = this.getWorldPosition();
        const dx = px.x - c.x;
        const dy = px.y - c.y;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }

    /**
     * Updates `action` from the current pointer pixel position.
     * @param {Vector} pixelPos
     */
    _updateAction(pixelPos) {
        const c = this.getWorldPosition();
        const dx = pixelPos.x - c.x;
        const dy = pixelPos.y - c.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
            const t = Math.min(len, this.radius) / this.radius;
            this.action.set((dx / len) * t, (dy / len) * t);
        } else {
            this.action.set(0, 0);
        }
    }

    /**
     * @param {Vector} pos
     * @returns {boolean}
     */
    onPointerStart(pos) {
        if (!this._hitTest(pos)) return false;
        this.pressed = true;
        this._updateAction(this._toPixels(pos));
        this.emitDeviceEvent("start", this.action.clone());
        return true;
    }

    /**
     * @param {Vector} pos
     */
    onPointerMove(pos) {
        this._updateAction(this._toPixels(pos));
        this.emitDeviceEvent("change", this.action.clone());
    }

    onPointerEnd() {
        this.pressed = false;
        this.action.set(0, 0);
        this.emitDeviceEvent("end", this.action.clone());
    }
}