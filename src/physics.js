/**
 * @typedef {{ mass?: number, inertia?: number, type?: "Circle" | "Polygon", radius?: number, vertices?: Vector[], restitution?: number, friction?: number }} BodyParams
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
     * @type {number | undefined}
     */
    radius;
    /**
     * @type {Vector[] | undefined}
     */
    vertices;

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
        this.restitution = params.restitution ?? 0.2;
        this.friction = params.friction ?? 0.4;
        this.type = params.type;
        this.radius = params.radius;
        this.vertices = params.vertices;
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
     * @param {CircleParams} params
     */
    constructor(params = {}) {
        const mass = params.mass ?? 1;
        const inertia = 0.5 * mass * params.radius * params.radius;
        super({ ...params, mass, inertia, type: "Circle" });
    }
}

// Polygon
/**
 * @typedef {BodyParams & MaterialParams & { vertices: Vector[] }} PolygonParams
 */
class Polygon extends Body {
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
        super({ ...params, mass, inertia, type: "Polygon" });
    }
}


// Manifold
/**
 * @typedef {{ bodyA: Body, bodyB: Body, normal: Vector, penetration: number, contacts: Vector[] }} ManifoldParams
 */
class Manifold {
    /**
     * @type {Body}
     */
    bodyA;
    /**
     * @type {Body}
     */
    bodyB;
    /**
     * @type {Vector}
     */
    normal;
    /**
     * @type {number}
     */
    penetration;
    /**
     * @type {Vector[]}
     */
    contacts;

    /**
     * @param {ManifoldParams} params
     */
    constructor(params) {
        this.bodyA = params.bodyA;
        this.bodyB = params.bodyB;
        this.normal = params.normal;
        this.penetration = params.penetration;
        this.contacts = params.contacts ?? [];
    }
}

// Collisions - for detecting collision between bodies
class Collisions {
    /**
     * @param {Body} bodyA
     * @param {Body} bodyB
     * @returns {Manifold | null}
     */
    static findCollision(bodyA, bodyB) {
        if (bodyA.type === "Circle" && bodyB.type === "Circle") return Collisions.circleVsCircle(bodyA, bodyB);
        if (bodyA.type === "Polygon" && bodyB.type === "Polygon") return Collisions.polygonVsPolygon(bodyA, bodyB);
        if (bodyA.type === "Circle" && bodyB.type === "Polygon") return Collisions.circleVsPolygon(bodyA, bodyB);
        if (bodyA.type === "Polygon" && bodyB.type === "Circle") {
            const m = Collisions.circleVsPolygon(bodyB, bodyA);
            if (m) { m.normal.negate();[m.bodyA, m.bodyB] = [m.bodyB, m.bodyA]; }
            return m;
        }
        return null;
    }

    /**
     * @param {Circle} a
     * @param {Circle} b
     * @returns {Manifold | null}
     */
    static circleVsCircle(a, b) {
        const diff = b.physPos.clone().sub(a.physPos);
        const dist = diff.length();
        const rSum = a.radius + b.radius;
        if (dist >= rSum) return null;
        const normal = dist > 0 ? diff.scale(1 / dist) : new Vector(1, 0);
        const pen = rSum - dist;
        const contact = a.physPos.clone().add(normal.clone().scale(a.radius - pen / 2));
        return new Manifold({ bodyA: a, bodyB: b, normal, penetration: pen, contacts: [contact] });
    }

    /**
     * @param {Polygon} a
     * @param {Polygon} b
     * @returns {Manifold | null}
     */
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
        let normal = refNormal.clone();
        if (flip) normal.negate();

        if (contacts.length === 0) {
            const refDist = refNormal.dot(refV1);
            let deepest = null, deepestD = 0;
            for (let v of incVerts) {
                const d = v.dot(refNormal) - refDist;
                if (d < deepestD) { deepestD = d; deepest = v; }
            }
            if (deepest) contacts = [deepest.clone()];
            else return null;
        }
        return new Manifold({ bodyA: a, bodyB: b, normal, penetration: Math.abs(ref.separation), contacts });
    }

    /**
     * @param {Vector[]} vertsA
     * @param {Vector[]} vertsB
     * @returns {{ separation: number, normal: Vector, edgeIndex: number }}
     */
    static findMinSeparation(vertsA, vertsB) {
        let bestSeparation = -Infinity, bestEdgeIndex = -1, bestNormal = null;
        for (let i = 0; i < vertsA.length; i++) {
            const edgeStart = vertsA[i];
            const edgeEnd = vertsA[(i + 1) % vertsA.length];
            const edgeVector = edgeEnd.clone().sub(edgeStart);
            const edgeNormal = new Vector(edgeVector.y, -edgeVector.x).normalize();
            let minSeparation = Infinity;
            for (const vertex of vertsB) {
                const projection = vertex.clone().sub(edgeStart).dot(edgeNormal);
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

    /**
     * @param {Vector[]} verts
     * @param {Vector} refNormal
     * @returns {{ v1: Vector, v2: Vector }}
     */
    static findIncidentEdge(verts, refNormal) {
        let minDot = Infinity, index = 0;
        for (let i = 0; i < verts.length; i++) {
            const edge = verts[(i + 1) % verts.length].clone().sub(verts[i]);
            const normal = new Vector(edge.y, -edge.x).normalize();
            const d = normal.dot(refNormal);
            if (d < minDot) { minDot = d; index = i; }
        }
        return { v1: verts[index], v2: verts[(index + 1) % verts.length] };
    }

    /**
     * @param {Vector} refV1
     * @param {Vector} refV2
     * @param {Vector} refNormal
     * @param {{ v1: Vector, v2: Vector }} incEdge
     * @returns {Vector[]}
     */
    static clipEdge(refV1, refV2, refNormal, incEdge) {
        const tangent = refV2.clone().sub(refV1).normalize();
        let cp = Collisions.clipSegment([incEdge.v1, incEdge.v2], refV1, tangent);
        if (cp.length < 2) return [];
        cp = Collisions.clipSegment(cp, refV2, tangent.clone().negate());
        if (cp.length < 2) return [];
        const refDist = refNormal.dot(refV1);
        const contacts = [];
        for (let p of cp) {
            if (p.dot(refNormal) - refDist <= 0) contacts.push(p);
        }
        return contacts;
    }

    /**
     * @param {Vector[]} points
     * @param {Vector} planePoint
     * @param {Vector} planeNormal
     * @returns {Vector[]}
     */
    static clipSegment(points, planePoint, planeNormal) {
        const out = [];
        const dist = p => p.clone().sub(planePoint).dot(planeNormal);
        let d0 = dist(points[0]), d1 = dist(points[1]);
        if (d0 >= 0) out.push(points[0]);
        if (d1 >= 0) out.push(points[1]);
        if ((d0 > 0 && d1 < 0) || (d0 < 0 && d1 > 0)) {
            const t = d0 / (d0 - d1);
            out.push(points[0].clone().lerp(points[1], t));
        }
        return out;
    }

    /**
     * @param {Circle} circle
     * @param {Polygon} polygon
     * @returns {Manifold | null}
     */
    static circleVsPolygon(circle, polygon) {
        const verts = polygon.getWorldVertices();
        let minOverlap = Infinity, bestAxis = null;

        for (let i = 0; i < verts.length; i++) {
            const edge = verts[(i + 1) % verts.length].clone().sub(verts[i]);
            const axis = new Vector(edge.y, -edge.x).normalize();
            const pPoly = Collisions.projectVerts(verts, axis);
            const cProj = circle.physPos.dot(axis);
            const pCircle = { min: cProj - circle.radius, max: cProj + circle.radius };
            if (pPoly.max < pCircle.min || pCircle.max < pPoly.min) return null;
            const overlap = Math.min(pPoly.max - pCircle.min, pCircle.max - pPoly.min);
            if (overlap < minOverlap) { minOverlap = overlap; bestAxis = axis; }
        }

        let closestVert = verts[0], closestDist = Infinity;
        for (const v of verts) {
            const d = circle.physPos.distance(v);
            if (d < closestDist) { closestDist = d; closestVert = v; }
        }
        const voronoiAxis = circle.physPos.clone().sub(closestVert).normalize();
        const pPoly2 = Collisions.projectVerts(verts, voronoiAxis);
        const cProj2 = circle.physPos.dot(voronoiAxis);
        const pCircle2 = { min: cProj2 - circle.radius, max: cProj2 + circle.radius };
        if (pPoly2.max < pCircle2.min || pCircle2.max < pPoly2.min) return null;
        const overlap2 = Math.min(pPoly2.max - pCircle2.min, pCircle2.max - pPoly2.min);
        if (overlap2 < minOverlap) { minOverlap = overlap2; bestAxis = voronoiAxis; }

        let normal = bestAxis.clone();
        if (polygon.physPos.clone().sub(circle.physPos).dot(normal) < 0) normal.negate();
        const contact = circle.physPos.clone().add(normal.clone().scale(circle.radius));
        return new Manifold({ bodyA: circle, bodyB: polygon, normal, penetration: minOverlap, contacts: [contact] });
    }

    /**
     * @param {Vector[]} verts
     * @param {Vector} axis
     * @returns {{ min: number, max: number }}
     */
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


// SimpleSolver
/**
 * @typedef {"collision:enter" | "collision:stay" | "collision:exit"} CollisionEventType
 */

class SimpleSolver {
    /**
     * Collision pairs detected in the previous step, keyed by sorted body id pair.
     * @type {Map<string, Manifold>}
     */
    _prevCollisions;

    constructor() {
        this._prevCollisions = new Map();
    }

    /**
     * Syncs each body's physics state from its scene position, integrates
     * physics, detects collisions, emits collision:enter / collision:stay /
     * collision:exit on each involved body, then syncs physics state back to
     * scene position.
     *
     * @param {Body[]} bodies
     * @param {number} dt
     */
    step(bodies, dt) {
        // Sync scene transform → physics state so external position changes
        // (teleports, initial placement) are picked up before integration.
        for (const body of bodies) {
            body.physPos.copy(body.getWorldPosition());
            body.physAngle = body.getWorldAngle();
        }

        // Integrate forces and velocities
        for (const body of bodies) {
            body.physicsUpdate(dt);
        }

        // Detect collisions
        /** @type {Map<string, Manifold>} */
        const current = new Map();

        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const a = bodies[i];
                const b = bodies[j];
                const manifold = Collisions.findCollision(a, b);
                if (!manifold) continue;
                const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
                current.set(key, manifold);
            }
        }

        for (const [key, manifold] of current) {
            /** @type {CollisionEventType} */
            const type = this._prevCollisions.has(key) ? "collision:stay" : "collision:enter";
            manifold.bodyA.emit(type, manifold);
            manifold.bodyB.emit(type, manifold);
        }

        for (const [key, manifold] of this._prevCollisions) {
            if (!current.has(key)) {
                manifold.bodyA.emit("collision:exit", manifold);
                manifold.bodyB.emit("collision:exit", manifold);
            }
        }

        this._prevCollisions = current;

        // Sync physics state → scene transform (includes positional corrections
        // from collision resolution applied during event handlers above)
        for (const body of bodies) {
            body.setWorldPosition(body.physPos);
            body.setWorldAngle(body.physAngle);
        }
    }
}

// Solver class

class Solver {
    constructor(iterations = 15) {
        this.iterations = iterations;
        this.manifolds = [];
        this.constraints = [];
        this.noCollide = new Set();
    }

    addConstraint(c) {
        this.constraints.push(c);
        this.excludeCollision(c.bodyA, c.bodyB);
    }

    excludeCollision(a, b) {
        const key = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
        this.noCollide.add(key);
    }

    shouldCollide(a, b) {
        const key = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
        return !this.noCollide.has(key);
    }

    detectCollisions(bodies) {
        this.manifolds = [];
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const a = bodies[i], b = bodies[j];
                if (a.invMass === 0 && b.invMass === 0) continue;
                if (!this.shouldCollide(a, b)) continue;
                const result = Collisions.findCollision(a, b);
                if (result) {
                    const newManifolds = Array.isArray(result) ? result : [result];
                    for (const m of newManifolds) {
                        if (m.contacts.length > 0) {
                            this.preCompute(m);
                            this.manifolds.push(m);
                        }
                    }
                }
            }
        }
    }

    preCompute(m) {
        const a = m.bodyA, b = m.bodyB;
        const n = m.normal;
        const t = new Vector(-n.y, n.x);
        m.e = Math.min(a.restitution, b.restitution);
        m.mu = Math.sqrt(a.friction * b.friction);
        m.tangent = t;
        m.contactData = [];
        for (let c of m.contacts) {
            const rA = Vector.sub(c, a.pos);
            const rB = Vector.sub(c, b.pos);
            const rAxN = rA.x * n.y - rA.y * n.x;
            const rBxN = rB.x * n.y - rB.y * n.x;
            const kN = a.invMass + b.invMass + rAxN * rAxN * a.invInertia + rBxN * rBxN * b.invInertia;
            const rAxT = rA.x * t.y - rA.y * t.x;
            const rBxT = rB.x * t.y - rB.y * t.x;
            const kT = a.invMass + b.invMass + rAxT * rAxT * a.invInertia + rBxT * rBxT * b.invInertia;
            m.contactData.push({
                rA, rB,
                massN: kN > 0 ? 1 / kN : 0,
                massT: kT > 0 ? 1 / kT : 0,
                jnAcc: 0, jtAcc: 0
            });
        }
    }

    preStepConstraints(dt) {
        for (let c of this.constraints) c.preStep(dt);
    }

    applySpringForces() {
        for (let c of this.constraints) {
            if (c instanceof SpringConstraint) c.applyForce();
        }
    }

    solve() {
        for (let iter = 0; iter < this.iterations; iter++) {
            for (let m of this.manifolds) this.solveManifold(m);
            for (let c of this.constraints) c.solve();
        }
    }

    solveManifold(m) {
        const a = m.bodyA, b = m.bodyB;
        const n = m.normal, t = m.tangent;
        for (let cd of m.contactData) {
            const { rA, rB } = cd;
            const dvx = (b.vel.x - b.angVel * rB.y) - (a.vel.x - a.angVel * rA.y);
            const dvy = (b.vel.y + b.angVel * rB.x) - (a.vel.y + a.angVel * rA.x);
            const vn = dvx * n.x + dvy * n.y;
            const e = (-vn > 1.0) ? m.e : 0;
            let jn = cd.massN * (-(1 + e) * vn);
            const jnOld = cd.jnAcc;
            cd.jnAcc = Math.max(jnOld + jn, 0);
            jn = cd.jnAcc - jnOld;
            const pnx = n.x * jn, pny = n.y * jn;
            a.vel.x -= pnx * a.invMass; a.vel.y -= pny * a.invMass;
            a.angVel -= (rA.x * pny - rA.y * pnx) * a.invInertia;
            b.vel.x += pnx * b.invMass; b.vel.y += pny * b.invMass;
            b.angVel += (rB.x * pny - rB.y * pnx) * b.invInertia;

            const dvx2 = (b.vel.x - b.angVel * rB.y) - (a.vel.x - a.angVel * rA.y);
            const dvy2 = (b.vel.y + b.angVel * rB.x) - (a.vel.y + a.angVel * rA.x);
            const vt = dvx2 * t.x + dvy2 * t.y;
            let jt = cd.massT * (-vt);
            const maxF = cd.jnAcc * m.mu;
            const jtOld = cd.jtAcc;
            cd.jtAcc = Math.max(-maxF, Math.min(jtOld + jt, maxF));
            jt = cd.jtAcc - jtOld;
            const ptx = t.x * jt, pty = t.y * jt;
            a.vel.x -= ptx * a.invMass; a.vel.y -= pty * a.invMass;
            a.angVel -= (rA.x * pty - rA.y * ptx) * a.invInertia;
            b.vel.x += ptx * b.invMass; b.vel.y += pty * b.invMass;
            b.angVel += (rB.x * pty - rB.y * ptx) * b.invInertia;
        }
    }

    correctPositions() {
        const percent = 0.4, slop = 0.01;
        for (let m of this.manifolds) {
            const a = m.bodyA, b = m.bodyB;
            const totalInv = a.invMass + b.invMass;
            if (totalInv === 0) continue;
            const corr = Math.max(m.penetration - slop, 0) / totalInv * percent;
            a.pos.x -= m.normal.x * corr * a.invMass;
            a.pos.y -= m.normal.y * corr * a.invMass;
            b.pos.x += m.normal.x * corr * b.invMass;
            b.pos.y += m.normal.y * corr * b.invMass;
        }
        for (let c of this.constraints) c.correctPosition();
    }

    drawDebug(ctx) {
        for (let m of this.manifolds) m.draw(ctx);
        for (let c of this.constraints) c.draw(ctx);
    }
}