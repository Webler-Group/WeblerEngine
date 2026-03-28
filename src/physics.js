/**
 * @typedef {Object} BodyParams
 * @property {number} [mass=1]
 * @property {number} [inertia=1000]
 */

class Body extends SceneNode {
    /** @param {BodyParams} [params] */
    constructor({ mass = 1, inertia = 1000 } = {}) {
        super();
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
