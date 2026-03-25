/**
 * @typedef {{ zIndex?: number, camera?: Camera | null }} DrawableParams
 */

/**
 * A SceneNode that can be drawn. Extend this and override draw(ctx).
 *
 * The world transform (position, angle, scale) is applied automatically by
 * Renderer before draw() is called — draw as if the node is at the origin,
 * facing right, at scale (1, 1). The canvas context is already transformed
 * to world space for you.
 *
 * zIndex controls draw order across all drawables in the scene — lower values
 * are drawn first (further behind). Drawables with equal zIndex are drawn in
 * the order they appear in scene.nodes.
 */
class Drawable extends SceneNode {
    /**
     * Draw order. Lower values are drawn first (behind higher values).
     * @type {number}
     */
    zIndex;
    /**
     * @type {Camera | null}
     */
    camera;

    /**
     * @param {DrawableParams} params
     */
    constructor(params = {}) {
        super();
        this.zIndex = params.zIndex ?? 0;
        this.camera = params.camera ?? null;
    }

    /**
     * Override in subclasses to issue canvas draw calls.
     *
     * The context transform is already set to this node's world transform
     * when this method is called — draw relative to (0, 0). Do not call
     * setTransform or resetTransform inside draw(); use ctx.save()/restore()
     * if you need temporary local transforms.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {

    }
}

/**
 * @typedef {{ width: number, height: number, fillColor: string | null, strokeColor?: string | null, lineWidth?: number } & DrawableParams} RectDrawableParams
 */

/**
 * A Drawable that renders a rectangle centered at the node's local origin.
 *
 * The rectangle is always centered at (0, 0) in local space. The world
 * transform (position, angle, scale) is applied by Renderer before draw()
 * is called, so the shape appears correctly in world space without any manual
 * offset calculations.
 *
 * Set fillColor or strokeColor to null to skip that part of the draw.
 * Extend this class and call super.draw(ctx) to add custom rendering on top.
 */
class RectDrawable extends Drawable {
    /**
     * Width of the rectangle in local units.
     * @type {number}
     */
    width;
    /**
     * Height of the rectangle in local units.
     * @type {number}
     */
    height;
    /**
     * CSS fill color, or null to skip filling.
     * @type {string | null}
     */
    fillColor;
    /**
     * CSS stroke color, or null to skip stroking.
     * @type {string | null}
     */
    strokeColor;
    /**
     * Stroke width in local units.
     * @type {number}
     */
    lineWidth;

    /**
     * @param {RectDrawableParams} params
     */
    constructor(params = {}) {
        super(params);
        this.width = params.width;
        this.height = params.height;
        this.fillColor = params.fillColor;
        this.strokeColor = params.strokeColor ?? null;
        this.lineWidth = params.lineWidth ?? 1;
    }

    /**
     * Draws a rectangle centered at (0, 0) in the Renderer-applied world
     * transform space. Fills first (if fillColor is set), then strokes (if
     * strokeColor is set) so the stroke sits on top of the fill.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        ctx.beginPath();
        ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
        if (this.fillColor !== null) {
            ctx.fillStyle = this.fillColor;
            ctx.fill();
        }
        if (this.strokeColor !== null) {
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.lineWidth;
            ctx.stroke();
        }
    }
}

/**
 * @typedef {{ radius: number, fillColor: string | null, strokeColor?: string | null, lineWidth?: number } & DrawableParams} CircleDrawableParams
 */

/**
 * A Drawable that renders a circle centered at the node's local origin.
 *
 * Because Renderer applies the full world transform via setTransform before
 * draw() is called, non-uniform scale (scale.x ≠ scale.y) will stretch the
 * circle into an ellipse — the arc is drawn at the given radius in local
 * space and then the transform scales it. This is usually the desired
 * behaviour for scaled nodes.
 *
 * Set fillColor or strokeColor to null to skip that part of the draw.
 * Extend this class and call super.draw(ctx) to add custom rendering on top.
 */
class CircleDrawable extends Drawable {
    /**
     * Radius of the circle in local units.
     * @type {number}
     */
    radius;
    /**
     * CSS fill color, or null to skip filling.
     * @type {string | null}
     */
    fillColor;
    /**
     * CSS stroke color, or null to skip stroking.
     * @type {string | null}
     */
    strokeColor;
    /**
     * Stroke width in local units.
     * @type {number}
     */
    lineWidth;

    /**
     * @param {CircleDrawableParams} params
     */
    constructor(params = {}) {
        super(params);
        this.radius = params.radius;
        this.fillColor = params.fillColor;
        this.strokeColor = params.strokeColor ?? null;
        this.lineWidth = params.lineWidth ?? 1;
    }

    /**
     * Draws a full circle centered at (0, 0) in the Renderer-applied world
     * transform space. Fills first (if fillColor is set), then strokes (if
     * strokeColor is set).
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        if (this.fillColor !== null) {
            ctx.fillStyle = this.fillColor;
            ctx.fill();
        }
        if (this.strokeColor !== null) {
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.lineWidth;
            ctx.stroke();
        }
    }
}

/**
 * A rectangular region on a sprite atlas, in pixels.
 * @typedef {{ x: number, y: number, width: number, height: number }} SpriteRegion
 */

/**
 * @typedef {{
 *   image: HTMLImageElement,
 *   spriteWidth: number,
 *   spriteHeight: number,
 *   columns: number,
 *   count: number,
 *   margin?: number,
 *   spacing?: number
 * }} SpritesheetParams
 */

/**
 * Describes the layout of a sprite atlas — a single image containing multiple
 * uniformly-sized frames arranged in a grid.
 *
 * Frames are indexed left-to-right, top-to-bottom starting at 0. count may be
 * less than columns × rows to account for partially-filled rows.
 *
 * margin is the gap in pixels between the atlas edge and the first frame.
 * spacing is the gap in pixels between adjacent frames.
 */
class Spritesheet {
    /**
     * The source image containing all frames.
     * @type {HTMLImageElement}
     */
    image;
    /**
     * Width of each frame in pixels.
     * @type {number}
     */
    spriteWidth;
    /**
     * Height of each frame in pixels.
     * @type {number}
     */
    spriteHeight;
    /**
     * Number of columns in the frame grid.
     * @type {number}
     */
    columns;
    /**
     * Total number of valid frames (may be less than columns × rows).
     * @type {number}
     */
    count;
    /**
     * Gap in pixels between the atlas edges and the first frame on each axis.
     * @type {number}
     */
    margin;
    /**
     * Gap in pixels between adjacent frames on each axis.
     * @type {number}
     */
    spacing;

    /**
     * @param {SpritesheetParams} params
     */
    constructor(params) {
        this.image = params.image;
        this.spriteWidth = params.spriteWidth;
        this.spriteHeight = params.spriteHeight;
        this.columns = params.columns;
        this.count = params.count;
        this.margin = params.margin ?? 0;
        this.spacing = params.spacing ?? 0;
    }

    /**
     * Returns the source rectangle on the atlas image for the given frame index.
     *
     * @param {number} frame  0-based frame index
     * @returns {SpriteRegion}
     */
    getRegion(frame) {
        const col = frame % this.columns;
        const row = Math.floor(frame / this.columns);
        return {
            x: this.margin + col * (this.spriteWidth + this.spacing),
            y: this.margin + row * (this.spriteHeight + this.spacing),
            width: this.spriteWidth,
            height: this.spriteHeight,
        };
    }
}

/**
 * @typedef {{ sheet: Spritesheet, region?: SpriteRegion } & DrawableParams} SpriteParams
 */

/**
 * A Drawable that renders a region of a Spritesheet.
 *
 * The region is drawn centered at (0, 0) in local space. The world transform
 * (position, angle, scale) is applied by Renderer before draw() is called.
 *
 * Assign region each update tick to animate:
 *   this.region = sheet.getRegion(Math.floor(t * 1000 / frameDuration) % sheet.count);
 */
class Sprite extends Drawable {
    /**
     * The spritesheet this sprite samples from.
     * @type {Spritesheet}
     */
    sheet;
    /**
     * The source rectangle on the atlas to draw. Assign a new region each
     * tick to advance animation frames.
     * @type {SpriteRegion}
     */
    region;

    /**
     * @param {SpriteParams} params
     */
    constructor(params) {
        super(params);
        this.sheet = params.sheet;
        this.region = params.region ?? params.sheet.getRegion(0);
    }

    /**
     * Draws region from the sheet, centered at (0, 0) in local space.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        const r = this.region;
        ctx.drawImage(
            this.sheet.image,
            r.x, r.y, r.width, r.height,
            -r.width / 2, -r.height / 2, r.width, r.height,
        );
    }
}

/**
 * A sequence of sprite regions played at a fixed rate.
 *
 * loop defaults to true. When false the animator holds the last frame after
 * the sequence ends.
 *
 * @typedef {{ name: string, frames: SpriteRegion[], frameDuration: number, loop?: boolean }} Animation
 */

/**
 * A SceneNode that drives frame animation on a Sprite by writing a new region
 * to it each update tick.
 *
 * Add both the Sprite and its Animator to the scene. The scene calls
 * update(dt) on the Animator automatically so the Sprite's region stays in
 * sync without any manual bookkeeping in game code.
 *
 * Emits:
 *   'start' — when play() is called:          { animation }
 *   'end'   — when a non-looping anim ends:   { animation }
 *
 * Typical setup:
 *   const sprite   = new Sprite({ sheet, zIndex: 1 });
 *   const animator = new Animator(sprite);
 *   scene.addNode(sprite);
 *   scene.addNode(animator);
 *   animator.play(walkAnim);
 *   animator.on('end', ({ data }) => animator.play(idleAnim));
 */
class Animator extends SceneNode {
    /**
     * The Sprite this animator writes region values to.
     * @type {Sprite}
     */
    sprite;
    /**
     * Currently playing animation, or null when idle.
     * @type {Animation | null}
     */
    _anim;
    /**
     * Elapsed time in seconds since the current animation started.
     * @type {number}
     */
    _t;

    /**
     * @param {Sprite} sprite
     */
    constructor(sprite) {
        super();
        this.sprite = sprite;
        this._anim = null;
        this._t = 0;
    }

    /**
     * Start playing an animation from the first frame.
     * Resets the elapsed time, so calling play() mid-animation restarts it.
     * Emits 'start'.
     *
     * @param {Animation} animation
     */
    play(animation) {
        this._anim = animation;
        this._t = 0;
        this.emit('start', { animation });
    }

    /**
     * Returns true if the animation with the given name is currently playing.
     * Useful to guard play() calls and avoid restarting an already-active animation.
     *
     *   if (!animator.isPlaying('walk')) animator.play(walkAnim);
     *
     * @param {string} name
     * @returns {boolean}
     */
    isPlaying(name) {
        return this._anim !== null && this._anim.name === name;
    }

    /**
     * Advances the animation timer and writes the corresponding region to the
     * sprite. Has no effect when no animation is playing.
     * Emits 'end' when a non-looping animation reaches its last frame.
     *
     * @param {number} dt
     */
    update(dt) {
        if (!this._anim) return;

        this._t += dt;

        const { frames, frameDuration, loop = true } = this._anim;
        let index = Math.floor(this._t * 1000 / frameDuration);

        if (loop) {
            index = index % frames.length;
        } else if (index >= frames.length) {
            this.sprite.region = frames[frames.length - 1];
            const anim = this._anim;
            this._anim = null;
            this.emit('end', { animation: anim });
            return;
        }

        this.sprite.region = frames[index];
    }
}

/**
 * @typedef {{ width: number, height: number }} Viewport
 */

/**
 * @typedef {{ viewport: Viewport, zoom?: number }} CameraParams
 */

/**
 * A SceneNode that defines the view and projection used to render a scene.
 *
 * Attach a Camera to a Drawable (via `drawable.camera`) to have that drawable
 * rendered through this camera's view. Drawables with `camera === null` are
 * drawn with an identity transform — useful for screen-space UI elements.
 *
 * The camera looks "into" the screen along the -Z axis. `up` controls which
 * world direction appears as screen-up; the default `(0, -1)` matches canvas
 * convention where Y increases downward.
 *
 * `zoom` scales the view uniformly: values > 1 zoom in (world units appear
 * larger), values < 1 zoom out. Zoom is applied in view space before
 * projection, so it is independent of the viewport size.
 *
 * All matrices are rebuilt once per frame in `update()` and cached. The
 * projection matrix is computed in normalised screen space (1×1); the
 * Renderer prepends a screen-scale transform to convert to canvas pixels.
 * Use `getViewMatrix()`, `getProjMatrix()`, and `getProjViewMatrix()` to
 * read the cached results at zero cost.
 *
 * Typical setup:
 *   const camera = new Camera({ viewport: { width: 320, height: 180 } });
 *   scene.addNode(camera);
 *   sprite.camera = camera;
 *   camera.position.set(playerX, playerY); // follow the player
 */
class Camera extends SceneNode {
    /**
     * The world direction that maps to screen-up.
     *
     * Defaults to `(0, -1)`, which matches canvas convention (Y increases
     * downward). Set to `(0, 1)` for a Y-up world. The vector does not need to
     * be normalized — it is re-normalized internally by `update()`.
     * @type {Vector}
     */
    up;
    /**
     * The logical size of the camera's view in world units.
     *
     * `getProjMatrix()` maps this rectangle to normalised screen space (1×1).
     * The Renderer scales to actual pixels via a screen-space transform.
     * A viewport of `{ width: 320, height: 180 }` on a 640×360 canvas
     * produces a ×2 pixel scale with no extra zoom applied.
     * @type {Viewport}
     */
    viewport;
    /**
     * Uniform zoom factor applied on top of the viewport-to-canvas scale.
     *
     * `1` (default) means no extra zoom. `2` makes world objects appear twice
     * as large; `0.5` makes them half as large. Must be > 0.
     * @type {number}
     */
    zoom;

    /** 
     * @type {DOMMatrix} 
     */
    _view;
    /** 
     * @type {DOMMatrix} 
     */
    _proj;
    /** 
     * @type {DOMMatrix} 
     */
    _projView;
    /**
     * @type {DOMMatrix}
     */
    _invProjView;
    /**
     * Scratch matrix reused each frame for T, R, Z — never read outside update().
     * @type {DOMMatrix}
     */
    _temp;

    /**
     * @param {CameraParams} params
     */
    constructor(params) {
        super();

        this.viewport = params.viewport;
        this.zoom = params.zoom ?? 1;
        this.up = new Vector(0, -1);

        this._view = new DOMMatrix();
        this._proj = new DOMMatrix();
        this._projView = new DOMMatrix();
        this._invProjView = new DOMMatrix();
        this._temp = new DOMMatrix();
    }

    /**
     * Rebuilds all cached matrices. Called automatically every frame via
     * `update()`. Projection is computed in normalised 1×1 screen space;
     * multiply by a screen-scale matrix ([W,0,0,H,0,0]) to get pixel coords.
     *
     * @param {number} dt
     */
    update(dt) {
        const pos = this.getWorldPosition();
        const up = new Vector(-this.up.x, -this.up.y);
        const right = new Vector(up.y, -up.x);

        const z = this.zoom;
        matIdentity(this._view)
            .multiplySelf(setMatrix(this._temp, z, 0, 0, z, 0, 0))
            .multiplySelf(setMatrix(this._temp, right.x, up.x, right.y, up.y, 0, 0))
            .multiplySelf(setMatrix(this._temp, 1, 0, 0, 1, -pos.x, -pos.y));

        const scaleX = 1 / this.viewport.width;
        const scaleY = 1 / this.viewport.height;
        this._proj.a = scaleX; this._proj.b = 0;
        this._proj.c = 0;      this._proj.d = scaleY;
        this._proj.e = 0.5;    this._proj.f = 0.5;

        matIdentity(this._projView).multiplySelf(this._proj).multiplySelf(this._view);
        matIdentity(this._invProjView).multiplySelf(this._projView).invertSelf();
    }

    /** @returns {DOMMatrix} Cached view matrix (world → camera space). */
    getViewMatrix() { return this._view; }

    /**
     * Cached projection matrix (camera space → normalised 1×1 screen space).
     * Multiply by a screen-scale matrix ([W,0,0,H,0,0]) to get pixel coords.
     * @returns {DOMMatrix}
     */
    getProjMatrix() { return this._proj; }

    /**
     * Cached combined proj × view matrix (world → normalised screen space).
     * @returns {DOMMatrix}
     */
    getProjViewMatrix() { return this._projView; }

    /**
     * Converts a normalised screen position to a world-space position.
     *
     * Normalised coords map the canvas to [0, 1] on both axes (top-left is
     * (0, 0), bottom-right is (1, 1)). Convert from pixels first:
     *   normX = pixelX / canvas.width
     *   normY = pixelY / canvas.height
     *
     * Uses the cached inverse of (proj × view) — free after `update()` runs.
     *
     * @param {number} normX  X in normalised screen space [0, 1].
     * @param {number} normY  Y in normalised screen space [0, 1].
     * @returns {Vector}
     */
    screenToWorld(normX, normY) {
        const pt = this._invProjView.transformPoint({ x: normX, y: normY });
        return new Vector(pt.x, pt.y);
    }
}

/**
 * @typedef {{
 *   button: Button,
 *   fillColor?: string | null,
 *   pressedFillColor?: string | null,
 *   strokeColor?: string | null,
 *   lineWidth?: number,
 *   text?: string | null,
 *   textColor?: string | null,
 *   font?: string | null
 * } & DrawableParams} ButtonDrawableParams
 */

/**
 * A Drawable that renders a Button control's hit area.
 *
 * Add this as a child of the Button node so it inherits the button's world
 * position. The shape (rect or circle) and dimensions are read directly from
 * the Button, so they always stay in sync.
 *
 * fillColor and pressedFillColor are swapped automatically based on
 * button.pressed — no extra update logic needed.
 */
class ButtonDrawable extends Drawable {
    /**
     * @type {Button}
     */
    button;
    /**
     * Fill color when the button is not pressed.
     * @type {string | null}
     */
    fillColor;
    /**
     * Fill color when the button is pressed.
     * @type {string | null}
     */
    pressedFillColor;
    /**
     * @type {string | null}
     */
    strokeColor;
    /**
     * @type {number}
     */
    lineWidth;
    /**
     * Label drawn centered on the button. Set to null for no text.
     * @type {string | null}
     */
    text;
    /**
     * CSS color for the label.
     * @type {string | null}
     */
    textColor;
    /**
     * CSS font string for the label (e.g. "bold 14px sans-serif").
     * @type {string | null}
     */
    font;

    /**
     * @param {ButtonDrawableParams} params
     */
    constructor(params) {
        super(params);
        this.button = params.button;
        this.fillColor = params.fillColor ?? "rgba(255,255,255,0.25)";
        this.pressedFillColor = params.pressedFillColor ?? "rgba(255,255,255,0.55)";
        this.strokeColor = params.strokeColor ?? "rgba(255,255,255,0.7)";
        this.lineWidth = params.lineWidth ?? 2;
        this.text = params.text ?? null;
        this.textColor = params.textColor ?? "rgba(255,255,255,0.9)";
        this.font = params.font ?? "bold 14px sans-serif";
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        const fill = this.button.pressed ? this.pressedFillColor : this.fillColor;
        ctx.beginPath();
        if (this.button.shape === "circle") {
            ctx.arc(0, 0, this.button.radius, 0, Math.PI * 2);
        } else {
            ctx.rect(
                -this.button.width / 2, -this.button.height / 2,
                this.button.width, this.button.height
            );
        }
        if (fill !== null) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        if (this.strokeColor !== null) {
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.lineWidth;
            ctx.stroke();
        }
        if (this.text !== null && this.textColor !== null) {
            ctx.font = this.font;
            ctx.fillStyle = this.textColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(this.text, 0, 0);
        }
    }
}

/**
 * @typedef {{
 *   joystick: PointerJoystick,
 *   stickRadius?: number,
 *   baseColor?: string | null,
 *   stickColor?: string | null,
 *   strokeColor?: string | null,
 *   lineWidth?: number
 * } & DrawableParams} JoystickDrawableParams
 */

/**
 * A Drawable that renders a PointerJoystick control.
 *
 * Add this as a child of the PointerJoystick node so it inherits the
 * joystick's world position. The outer base circle uses joystick.radius.
 * The inner stick is offset by joystick.action scaled to the outer radius,
 * updating automatically each frame as action changes.
 */
class JoystickDrawable extends Drawable {
    /**
     * @type {PointerJoystick}
     */
    joystick;
    /**
     * Radius of the inner stick knob in canvas pixels.
     * @type {number}
     */
    stickRadius;
    /**
     * Fill color for the outer base ring.
     * @type {string | null}
     */
    baseColor;
    /**
     * Fill color for the inner stick knob.
     * @type {string | null}
     */
    stickColor;
    /**
     * @type {string | null}
     */
    strokeColor;
    /**
     * @type {number}
     */
    lineWidth;

    /**
     * @param {JoystickDrawableParams} params
     */
    constructor(params) {
        super(params);
        this.joystick = params.joystick;
        this.stickRadius = params.stickRadius ?? 20;
        this.baseColor = params.baseColor ?? "rgba(255,255,255,0.12)";
        this.stickColor = params.stickColor ?? "rgba(255,255,255,0.45)";
        this.strokeColor = params.strokeColor ?? "rgba(255,255,255,0.35)";
        this.lineWidth = params.lineWidth ?? 2;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        const r = this.joystick.radius;

        // Outer base
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        if (this.baseColor !== null) {
            ctx.fillStyle = this.baseColor;
            ctx.fill();
        }
        if (this.strokeColor !== null) {
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.lineWidth;
            ctx.stroke();
        }

        // Inner stick knob offset by action
        const sx = this.joystick.action.x * r;
        const sy = this.joystick.action.y * r;
        ctx.beginPath();
        ctx.arc(sx, sy, this.stickRadius, 0, Math.PI * 2);
        if (this.stickColor !== null) {
            ctx.fillStyle = this.stickColor;
            ctx.fill();
        }
        if (this.strokeColor !== null) {
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.lineWidth;
            ctx.stroke();
        }
    }
}

/**
 * Internal grouping of drawables that share a zIndex.
 * @typedef {{ zIndex: number, drawables: Drawable[] }} RenderLayer
 */

/**
 * Draws all Drawable nodes to a canvas each frame, sorted by zIndex.
 *
 * Renderer owns the canvas and its 2D context. It applies each drawable's
 * world transform before calling draw(), so subclasses of Drawable can issue
 * draw calls in local space.
 *
 * Typical game loop:
 *   sm.update(dt);
 *   renderer.render(sm.currentScene.findNodesByType(Drawable));
 */
class Renderer {
    /**
     * The canvas this renderer draws to.
     * @type {HTMLCanvasElement}
     */
    canvas;
    /**
     * The 2D rendering context derived from canvas.
     * @type {CanvasRenderingContext2D}
     */
    ctx;
    /**
     * CSS color string used to fill the canvas at the start of each render call.
     * Set to null to skip clearing — useful when compositing multiple passes or
     * rendering on top of a CSS background.
     * @type {string | null}
     */
    clearColor;
    /**
     * Reused each frame to map normalised camera space (1×1) to canvas pixels.
     * Updated at the start of render() whenever canvas dimensions change.
     * @type {DOMMatrix}
     */
    _screenMatrix;

    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.clearColor = '#000000';
        this._screenMatrix = new DOMMatrix();
    }

    /**
     * Clears the canvas (if clearColor is set), then draws all drawables
     * sorted by zIndex from lowest to highest.
     *
     * Each drawable's world transform is applied via setTransform before its
     * draw() method is called. After all drawables are drawn the transform is
     * reset to the identity matrix so the context is clean for the next frame.
     *
     * @param {Drawable[]} drawables
     */
    render(drawables) {
        if (this.clearColor !== null) {
            this.ctx.fillStyle = this.clearColor;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Group drawables by zIndex so we can sort layers without a full sort
        // of the entire drawables array.
        /** @type {Map<string, RenderLayer>} */
        const layers = new Map();
        /** @type {Map<string, DOMMatrix>} */
        const cameraMatrices = new Map();
        const W = this.canvas.width;
        const H = this.canvas.height;
        // Maps normalised camera space (1×1) to canvas pixels.
        setMatrix(this._screenMatrix, W, 0, 0, H, 0, 0);

        for (const drawable of drawables) {
            const key = this._getLayerKey(drawable);
            if (!layers.has(key)) {
                layers.set(key, { zIndex: drawable.zIndex, drawables: [] });
            }
            layers.get(key).drawables.push(drawable);

            const cam = drawable.camera;
            if (cam !== null) {
                const camKey = cam.id;
                if (!cameraMatrices.has(camKey)) {
                    cameraMatrices.set(camKey, this._screenMatrix.multiply(cam.getProjViewMatrix()));
                }
            }
        }

        for (const layer of [...layers.values()].sort((a, b) => a.zIndex - b.zIndex)) {
            for (const drawable of layer.drawables) {
                this.ctx.setTransform(this._computeMatrix(drawable, cameraMatrices));
                drawable.draw(this.ctx);
            }
        }

        this.ctx.resetTransform();
    }

    /**
     * Builds the 2D affine matrix for a drawable's world transform.
     * Combines world position, rotation, and scale into a single DOMMatrix
     * so the renderer can apply all three in one setTransform call.
     *
     * Matrix layout (column-major, homogeneous 2D):
     *   | a  c  e |   | sx·cos  -sy·sin  tx |
     *   | b  d  f | = | sx·sin   sy·cos  ty |
     *   | 0  0  1 |   |      0        0   1 |
     *
     * @param {Drawable} drawable
     * @param {Map<string, DOMMatrix>} cameraMatrices
     * @returns {DOMMatrix}
     */
    _computeMatrix(drawable, cameraMatrices) {
        const pos = drawable.getWorldPosition();
        const angle = drawable.getWorldAngle();
        const scale = drawable.getWorldScale();
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const transformMatrix = new DOMMatrix([
            scale.x * cos,   // a
            scale.x * sin,   // b
            -scale.y * sin,  // c
            scale.y * cos,   // d
            pos.x,           // e (tx)
            pos.y,           // f (ty)
        ]);
        if (drawable.camera !== null) {
            const camKey = drawable.camera.id;
            return cameraMatrices.get(camKey).multiply(transformMatrix);
        }
        return transformMatrix;
    }

    /**
     * Returns the map key for a drawable's layer bucket.
     * Keying by zIndex string keeps insertion and lookup O(1).
     *
     * @param {Drawable} drawable
     * @returns {string}
     */
    _getLayerKey(drawable) {
        return `${drawable.zIndex}:${drawable.camera?.id ?? ''}`;
    }
}
