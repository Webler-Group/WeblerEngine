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



// Bodies
// Circle
class Circle extends Body {
    constructor(x, y, radius, mass = 1, material = {}) {
        const inertia = 0.5 * mass * radius * radius;
        super(x, y, mass, inertia);
        this.radius = radius;
        this.type = "Circle";
        if (material.restitution !== undefined) this.restitution = material.restitution;
        if (material.friction !== undefined) this.friction = material.friction;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        if (this.render) {
            this.render(ctx);
            ctx.restore();
            return;
        }
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fill();
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.radius, 0);
        ctx.stroke();
        ctx.restore();
    }
}

// Polygon 
class Polygon extends Body {
    constructor(x, y, vertices, mass = 1, material = {}) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let v of vertices) {
            minX = Math.min(minX, v.x); minY = Math.min(minY, v.y);
            maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y);
        }
        const width = maxX - minX, height = maxY - minY;
        const inertia = (1 / 12) * mass * (width * width + height * height);
        super(x, y, mass, inertia);
        this.vertices = vertices;
        this.type = "Polygon";
        if (material.restitution !== undefined) this.restitution = material.restitution;
        if (material.friction !== undefined) this.friction = material.friction;
    }
    getWorldVertices() {
        const worldVertices = [];
        for (let i = 0; i < this.vertices.length; i++) {
            const v = this.vertices[i].copy();
            v.rotate(this.angle);
            v.add(this.pos);
            worldVertices.push(v);
        }
        return worldVertices;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        if (this.render) {
            this.render(ctx);
            ctx.restore();
            return;
        }
        ctx.beginPath();
        if (this.vertices.length > 0) {
            ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
            for (let i = 1; i < this.vertices.length; i++) {
                ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
            }
            ctx.closePath();
        }
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fill();
        ctx.strokeStyle = "#aaa";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

