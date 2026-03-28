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


// Manifold

class Manifold {
    constructor(bodyA, bodyB, normal, penetration, contacts) {
        this.bodyA = bodyA;
        this.bodyB = bodyB;
        this.normal = normal;
        this.penetration = penetration;
        this.contacts = contacts || [];
    }
    draw(ctx) {
        if (this.contacts.length === 0) return;
        ctx.save();
        ctx.fillStyle = "rgba(0, 255, 136, 0.8)";
        for (let c of this.contacts) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        let avg = new Vector(0, 0);
        for (let c of this.contacts) avg.add(c);
        avg.div(this.contacts.length);
        const tip = avg.copy().add(this.normal.copy().mult(15));
        ctx.strokeStyle = "rgba(255, 50, 50, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(avg.x, avg.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        ctx.restore();
    }
}

// Collisions - for deteciting collision between bodies
class Collisions {
    static findCollision(bodyA, bodyB) {
        if (bodyA.type === "Circle" && bodyB.type === "Circle") return Collisions.circleVsCircle(bodyA, bodyB);
        if (bodyA.type === "Polygon" && bodyB.type === "Polygon") return Collisions.polygonVsPolygon(bodyA, bodyB);
        if (bodyA.type === "Circle" && bodyB.type === "Polygon") return Collisions.circleVsPolygon(bodyA, bodyB);
        if (bodyA.type === "Polygon" && bodyB.type === "Circle") {
            const m = Collisions.circleVsPolygon(bodyB, bodyA);
            if (m) { m.normal.mult(-1);[m.bodyA, m.bodyB] = [m.bodyB, m.bodyA]; }
            return m;
        }
        return null;
    }

    static circleVsCircle(a, b) {
        const diff = Vector.sub(b.pos, a.pos);
        const dist = diff.mag();
        const rSum = a.radius + b.radius;
        if (dist >= rSum) return null;
        const normal = dist > 0 ? diff.copy().div(dist) : new Vector(1, 0);
        const pen = rSum - dist;
        const contact = a.pos.copy().add(normal.copy().mult(a.radius - pen / 2));
        return new Manifold(a, b, normal, pen, [contact]);
    }

    static polygonVsPolygon(a, b) {
        const vertsA = a.getWorldVertices();
        const vertsB = b.getWorldVertices();
        const resA = Collisions.findMinSeparation(vertsA, vertsB);
        if (resA.separation > 0) return null;
        const resB = Collisions.findMinSeparation(vertsB, vertsA);
        if (resB.separation > 0) return null;

        let ref, refVerts, incVerts, flip;
        if (resA.separation > resB.separation) {
            ref = resA; refVerts = vertsA; incVerts = vertsB; flip = false;
        } else {
            ref = resB; refVerts = vertsB; incVerts = vertsA; flip = true;
        }

        const i = ref.edgeIndex;
        const refV1 = refVerts[i];
        const refV2 = refVerts[(i + 1) % refVerts.length];
        const refNormal = ref.normal;
        const incEdge = Collisions.findIncidentEdge(incVerts, refNormal);
        let contacts = Collisions.clipEdge(refV1, refV2, refNormal, incEdge);
        let normal = refNormal.copy();
        if (flip) normal.mult(-1);

        if (contacts.length === 0) {
            const refDist = refNormal.dot(refV1);
            let deepest = null, deepestD = 0;
            for (let v of incVerts) {
                const d = v.dot(refNormal) - refDist;
                if (d < deepestD) { deepestD = d; deepest = v; }
            }
            if (deepest) contacts = [deepest.copy()];
            else return null;
        }
        return new Manifold(a, b, normal, Math.abs(ref.separation), contacts);
    }

    static findMinSeparation(vertsA, vertsB) {
        let bestSeparation = -Infinity, bestEdgeIndex = -1, bestNormal = null;
        for (let i = 0; i < vertsA.length; i++) {
            const edgeStart = vertsA[i];
            const edgeEnd = vertsA[(i + 1) % vertsA.length];
            const edgeVector = Vector.sub(edgeEnd, edgeStart);
            const edgeNormal = new Vector(edgeVector.y, -edgeVector.x).normalize();
            let minSeparation = Infinity;
            for (const vertex of vertsB) {
                const projection = Vector.sub(vertex, edgeStart).dot(edgeNormal);
                if (projection < minSeparation) minSeparation = projection;
            }
            if (minSeparation > bestSeparation) {
                bestSeparation = minSeparation;
                bestNormal = edgeNormal;
                bestEdgeIndex = i;
            }
        }
        return { separation: bestSeparation, normal: bestNormal, edgeIndex: bestEdgeIndex };
    }

    static findIncidentEdge(verts, refNormal) {
        let minDot = Infinity, index = 0;
        for (let i = 0; i < verts.length; i++) {
            const edge = Vector.sub(verts[(i + 1) % verts.length], verts[i]);
            const normal = new Vector(edge.y, -edge.x).normalize();
            const d = normal.dot(refNormal);
            if (d < minDot) { minDot = d; index = i; }
        }
        return { v1: verts[index], v2: verts[(index + 1) % verts.length] };
    }

    static clipEdge(refV1, refV2, refNormal, incEdge) {
        const tangent = Vector.sub(refV2, refV1).normalize();
        let cp = Collisions.clipSegment([incEdge.v1, incEdge.v2], refV1, tangent);
        if (cp.length < 2) return [];
        cp = Collisions.clipSegment(cp, refV2, tangent.copy().mult(-1));
        if (cp.length < 2) return [];
        const refDist = refNormal.dot(refV1);
        const contacts = [];
        for (let p of cp) {
            if (p.dot(refNormal) - refDist <= 0) contacts.push(p);
        }
        return contacts;
    }

    static clipSegment(points, planePoint, planeNormal) {
        const out = [];
        const dist = p => Vector.sub(p, planePoint).dot(planeNormal);
        let d0 = dist(points[0]), d1 = dist(points[1]);
        if (d0 >= 0) out.push(points[0]);
        if (d1 >= 0) out.push(points[1]);
        if ((d0 > 0 && d1 < 0) || (d0 < 0 && d1 > 0)) {
            const t = d0 / (d0 - d1);
            out.push(Vector.lerp(points[0], points[1], t));
        }
        return out;
    }

    static circleVsPolygon(circle, polygon) {
        const verts = polygon.getWorldVertices();
        let minOverlap = Infinity, bestAxis = null;

        for (let i = 0; i < verts.length; i++) {
            const edge = Vector.sub(verts[(i + 1) % verts.length], verts[i]);
            const axis = new Vector(edge.y, -edge.x).normalize();
            const pPoly = Collisions.projectVerts(verts, axis);
            const cProj = circle.pos.dot(axis);
            const pCircle = { min: cProj - circle.radius, max: cProj + circle.radius };
            if (pPoly.max < pCircle.min || pCircle.max < pPoly.min) return null;
            const overlap = Math.min(pPoly.max - pCircle.min, pCircle.max - pPoly.min);
            if (overlap < minOverlap) { minOverlap = overlap; bestAxis = axis; }
        }

        let closestVert = verts[0], closestDist = Infinity;
        for (const v of verts) {
            const d = Vector.dist(circle.pos, v);
            if (d < closestDist) { closestDist = d; closestVert = v; }
        }
        const voronoiAxis = Vector.sub(circle.pos, closestVert).normalize();
        const pPoly2 = Collisions.projectVerts(verts, voronoiAxis);
        const cProj2 = circle.pos.dot(voronoiAxis);
        const pCircle2 = { min: cProj2 - circle.radius, max: cProj2 + circle.radius };
        if (pPoly2.max < pCircle2.min || pCircle2.max < pPoly2.min) return null;
        const overlap2 = Math.min(pPoly2.max - pCircle2.min, pCircle2.max - pPoly2.min);
        if (overlap2 < minOverlap) { minOverlap = overlap2; bestAxis = voronoiAxis; }

        let normal = bestAxis.copy();
        if (Vector.sub(polygon.pos, circle.pos).dot(normal) < 0) normal.mult(-1);
        const contact = circle.pos.copy().add(normal.copy().mult(circle.radius));
        return new Manifold(circle, polygon, normal, minOverlap, [contact]);
    }

    static projectVerts(verts, axis) {
        let min = Infinity, max = -Infinity;
        for (let v of verts) {
            const p = v.dot(axis);
            if (p < min) min = p;
            if (p > max) max = p;
        }
        return { min, max };
    }
}