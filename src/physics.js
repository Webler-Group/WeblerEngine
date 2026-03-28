/**
 * @typedef {{ mass?: number, inertia?: number, type?: "Circle" | "Polygon" }} BodyParams
 */


class Body extends SceneNode {
    /**
     * @type {Vector}
     */
    physPos;
    /**
     * @type {Vector}
     */
    vel;
    /**
     * @type {Vector}
     */
    acc;
    /**
     * @type {number}
     */
    physAngle;
    /**
     * @type {number}
     */
    angVel;
    /**
     * @type {number}
     */
    angAcc;
    /**
     * @type {number}
     */
    mass;
    /**
     * @type {number}
     */
    invMass;
    /**
     * @type {number}
     */
    inertia;
    /**
     * @type {number}
     */
    invInertia;
    /**
     * @type {Vector}
     */
    force;
    /**
     * @type {number}
     */
    torque;
    /**
     * @type {number}
     */
    restitution;
    /**
     * @type {number}
     */
    friction;
    /**
     * @type {"Circle" | "Polygon"}
     */
    type;

    /**
     * @param {BodyParams} params
     */
    constructor(params = {}) {
        super();
        const mass = params.mass ?? 1;
        const inertia = params.inertia ?? 1000;
        this.physPos = new Vector(0, 0);
        this.vel = new Vector(0, 0);
        this.acc = new Vector(0, 0);
        this.physAngle = 0;
        this.angVel = 0;
        this.angAcc = 0;
        this.mass = mass;
        this.invMass = mass === 0 ? 0 : 1 / mass;
        this.inertia = inertia;
        this.invInertia = inertia === 0 ? 0 : 1 / inertia;
        this.force = new Vector(0, 0);
        this.torque = 0;
        this.restitution = 0.2;
        this.friction = 0.4;
        this.type = params.type;
    }
    setStatic() {
        this.mass = 0; this.invMass = 0;
        this.inertia = 0; this.invInertia = 0;
        this.vel.set(0, 0); this.angVel = 0;
    }
    applyForce(force) { this.force.add(force); }
    applyForceAtPoint(force, point) {
        this.force.add(force);
        const r = point.clone().sub(this.physPos);
        this.torque += r.x * force.y - r.y * force.x;
    }
    integrateVelocity(dt) {
        if (this.invMass === 0) return;
        this.vel.add(this.force.clone().scale(this.invMass * dt));
        this.angVel += this.torque * this.invInertia * dt;
    }
    integratePosition(dt) {
        if (this.invMass === 0) return;
        this.physPos.add(this.vel.clone().scale(dt));
        this.physAngle += this.angVel * dt;
    }
    clearForces() { this.force.set(0, 0); this.torque = 0; }
    physicsUpdate(dt) {
        if (this.invMass === 0) return;
        this.integrateVelocity(dt);
        this.integratePosition(dt);
        this.clearForces();
    }
}



// Bodies
/**
 * @typedef {{ mass?: number, restitution?: number, friction?: number }} MaterialParams
 */

/**
 * @typedef {BodyParams & MaterialParams & { radius: number }} CircleParams
 */
class Circle extends Body {
    /**
     * @type {number}
     */
    radius;
    /**
     * @type {number}
     */
    restitution;
    /**
     * @type {number}
     */
    friction;

    /**
     * @param {CircleParams} params
     */
    constructor(params = {}) {
        const mass = params.mass ?? 1;
        const inertia = 0.5 * mass * params.radius * params.radius;
        super({ mass, inertia, type: "Circle" });
        this.radius = params.radius;
        if (params.restitution !== undefined) this.restitution = params.restitution;
        if (params.friction !== undefined) this.friction = params.friction;
    }
}

// Polygon
/**
 * @typedef {BodyParams & MaterialParams & { vertices: Vector[] }} PolygonParams
 */
class Polygon extends Body {
    /**
     * @type {Vector[]}
     */
    vertices;
    /**
     * @type {number}
     */
    restitution;
    /**
     * @type {number}
     */
    friction;

    /**
     * @param {PolygonParams} params
     */
    constructor(params = {}) {
        const mass = params.mass ?? 1;
        const vertices = params.vertices;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let v of vertices) {
            minX = Math.min(minX, v.x); minY = Math.min(minY, v.y);
            maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y);
        }
        const width = maxX - minX, height = maxY - minY;
        const inertia = (1 / 12) * mass * (width * width + height * height);
        super({ mass, inertia, type: "Polygon" });
        this.vertices = vertices;
        if (params.restitution !== undefined) this.restitution = params.restitution;
        if (params.friction !== undefined) this.friction = params.friction;
    }
    getWorldVertices() {
        const worldVertices = [];
        for (let i = 0; i < this.vertices.length; i++) {
            const v = this.vertices[i].clone();
            v.rotate(this.physAngle);
            v.add(this.physPos);
            worldVertices.push(v);
        }
        return worldVertices;
    }
}
