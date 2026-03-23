/**
 * Mutable 2D vector. All operations mutate `this` and return `this` for
 * chaining, so no intermediate allocations occur. Use `clone()` before an
 * operation when you need to preserve the original value.
 *
 * @example
 * // cheap — mutates in place
 * node.position.add(velocity).scale(dt);
 *
 * // safe — preserves original
 * const world = node.position.clone().add(offset);
 */
class Vector {
    /**
     * @param {number} x
     * @param {number} y
     */
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    // -------------------------------------------------------------------------
    // Static factories
    // -------------------------------------------------------------------------

    /** @returns {Vector} */
    static zero() { return new Vector(0, 0); }

    /** @returns {Vector} */
    static one() { return new Vector(1, 1); }

    /**
     * @param {Vector} v
     * @returns {Vector}
     */
    static from(v) { return new Vector(v.x, v.y); }

    /**
     * Returns a unit vector pointing at `angleRad` (radians, from +X axis).
     *
     * @param {number} angleRad
     * @returns {Vector}
     */
    static fromAngle(angleRad) {
        return new Vector(Math.cos(angleRad), Math.sin(angleRad));
    }

    // -------------------------------------------------------------------------
    // Assignment
    // -------------------------------------------------------------------------

    /**
     * @param {number} x
     * @param {number} y
     * @returns {this}
     */
    set(x, y) { this.x = x; this.y = y; return this; }

    /**
     * Copies `v` into `this`.
     *
     * @param {Vector} v
     * @returns {this}
     */
    copy(v) { this.x = v.x; this.y = v.y; return this; }

    /** @returns {Vector} */
    clone() { return new Vector(this.x, this.y); }

    // -------------------------------------------------------------------------
    // Arithmetic (mutate this, return this)
    // -------------------------------------------------------------------------

    /**
     * @param {Vector} v
     * @returns {this}
     */
    add(v) { this.x += v.x; this.y += v.y; return this; }

    /**
     * @param {Vector} v
     * @returns {this}
     */
    sub(v) { this.x -= v.x; this.y -= v.y; return this; }

    /**
     * Component-wise multiply. Useful for applying a scale vector.
     *
     * @param {Vector} v
     * @returns {this}
     */
    mul(v) { this.x *= v.x; this.y *= v.y; return this; }

    /**
     * Component-wise divide.
     *
     * @param {Vector} v
     * @returns {this}
     */
    div(v) { this.x /= v.x; this.y /= v.y; return this; }

    /**
     * Uniform scalar multiply.
     *
     * @param {number} s
     * @returns {this}
     */
    scale(s) { this.x *= s; this.y *= s; return this; }

    /** @returns {this} */
    negate() { this.x = -this.x; this.y = -this.y; return this; }

    // -------------------------------------------------------------------------
    // Geometry (mutate this, return this)
    // -------------------------------------------------------------------------

    /**
     * Normalizes `this` in place. No-op if length is 0.
     *
     * @returns {this}
     */
    normalize() {
        const len = this.length();
        if (len > 0) { this.x /= len; this.y /= len; }
        return this;
    }

    /**
     * Rotates `this` in place by `angleRad` radians.
     *
     * @param {number} angleRad
     * @returns {this}
     */
    rotate(angleRad) {
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        const x = this.x * cos - this.y * sin;
        this.y   = this.x * sin + this.y * cos;
        this.x   = x;
        return this;
    }

    /**
     * Linear interpolation towards `v` by factor `t` (0 = this, 1 = v).
     *
     * @param {Vector} v
     * @param {number} t
     * @returns {this}
     */
    lerp(v, t) {
        this.x += (v.x - this.x) * t;
        this.y += (v.y - this.y) * t;
        return this;
    }

    // -------------------------------------------------------------------------
    // Read-only queries (return scalars / booleans — no allocation)
    // -------------------------------------------------------------------------

    /** @returns {number} */
    length() { return Math.sqrt(this.x * this.x + this.y * this.y); }

    /** Squared length — cheaper than `length()`, useful for comparisons. @returns {number} */
    lengthSq() { return this.x * this.x + this.y * this.y; }

    /**
     * @param {Vector} v
     * @returns {number}
     */
    dot(v) { return this.x * v.x + this.y * v.y; }

    /**
     * 2D cross product — returns the Z component of the 3D cross product.
     * Positive means `v` is counter-clockwise from `this`.
     *
     * @param {Vector} v
     * @returns {number}
     */
    cross(v) { return this.x * v.y - this.y * v.x; }

    /**
     * @param {Vector} v
     * @returns {number}
     */
    distance(v) {
        const dx = this.x - v.x, dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Squared distance — cheaper than `distance()`, useful for comparisons.
     *
     * @param {Vector} v
     * @returns {number}
     */
    distanceSq(v) {
        const dx = this.x - v.x, dy = this.y - v.y;
        return dx * dx + dy * dy;
    }

    /**
     * Angle of this vector from the +X axis, in radians. Range: (-π, π].
     *
     * @returns {number}
     */
    angle() { return Math.atan2(this.y, this.x); }

    /**
     * @param {Vector} v
     * @param {number} epsilon
     * @returns {boolean}
     */
    equals(v, epsilon = 0) {
        return Math.abs(this.x - v.x) <= epsilon && Math.abs(this.y - v.y) <= epsilon;
    }

    /** @returns {string} */
    toString() { return `Vector(${this.x}, ${this.y})`; }
}

const loadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = () => reject("Failed to load image: " + url);
    });
};