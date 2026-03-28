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


/**
 * @typedef {"collision:enter" | "collision:stay" | "collision:exit"} CollisionEventType
 */

class Solver {
    /**
     * @type {number}
     */
    iterations;
    /**
     * @type {Manifold[]}
     */
    manifolds;
    /**
     * @type {Set<string>}
     */
    noCollide;
    /**
     * Collision pairs from the previous step for enter/stay/exit diffing.
     * @type {Map<string, Manifold>}
     */
    _prevCollisions;

    /**
     * @param {number} [iterations=15]
     */
    constructor(iterations = 15) {
        this.iterations = iterations;
        this.manifolds = [];
        this._prevCollisions = new Map();
        this.noCollide = new Set();
    }

    /**
     * @param {Body} a
     * @param {Body} b
     */
    excludeCollision(a, b) {
        const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        this.noCollide.add(key);
    }

    /**
     * @param {Body} a
     * @param {Body} b
     * @returns {boolean}
     */
    shouldCollide(a, b) {
        const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        return !this.noCollide.has(key);
    }

    /**
     * @param {Body[]} bodies
     */
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

    /**
     * @param {Manifold} m
     */
    preCompute(m) {
        const a = m.bodyA, b = m.bodyB;
        const n = m.normal;
        const t = new Vector(-n.y, n.x);
        m.e = Math.min(a.restitution, b.restitution);
        m.mu = Math.sqrt(a.friction * b.friction);
        m.tangent = t;
        m.contactData = [];
        for (const c of m.contacts) {
            const rA = c.clone().sub(a.physPos);
            const rB = c.clone().sub(b.physPos);
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
                jnAcc: 0, jtAcc: 0,
            });
        }
    }

    /**
     * @param {Constraint[]} constraints
     * @param {number} dt
     */
    preStepConstraints(constraints, dt) {
        for (const c of constraints) c.preStep(dt);
    }

    /**
     * @param {Constraint[]} constraints
     */
    applySpringForces(constraints) {
        for (const c of constraints) {
            if (c instanceof SpringConstraint) c.applyForce();
        }
    }

    /**
     * @param {Constraint[]} constraints
     */
    solve(constraints) {
        for (let iter = 0; iter < this.iterations; iter++) {
            for (const m of this.manifolds) this.solveManifold(m);
            for (const c of constraints) c.solve();
        }
    }

    /**
     * @param {Manifold} m
     */
    solveManifold(m) {
        const a = m.bodyA, b = m.bodyB;
        const n = m.normal, t = m.tangent;
        for (const cd of m.contactData) {
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

    /**
     * @param {Constraint[]} constraints
     */
    correctPositions(constraints) {
        const percent = 0.4, slop = 0.01;
        for (const m of this.manifolds) {
            const a = m.bodyA, b = m.bodyB;
            const totalInv = a.invMass + b.invMass;
            if (totalInv === 0) continue;
            const corr = Math.max(m.penetration - slop, 0) / totalInv * percent;
            a.physPos.x -= m.normal.x * corr * a.invMass;
            a.physPos.y -= m.normal.y * corr * a.invMass;
            b.physPos.x += m.normal.x * corr * b.invMass;
            b.physPos.y += m.normal.y * corr * b.invMass;
        }
        for (const c of constraints) c.correctPosition();
    }

    /**
     * @param {Body[]} bodies
     * @param {Constraint[]} constraints
     * @param {number} dt
     */
    step(bodies, constraints, dt) {
        // Sync scene transform → physics state
        for (const body of bodies) {
            body.physPos.copy(body.getWorldPosition());
            body.physAngle = body.getWorldAngle();
        }

        for (const c of constraints) {
            this.excludeCollision(c.bodyA, c.bodyB);
        }

        // 1. Apply spring / constraint forces
        this.applySpringForces(constraints);

        // 2. Detect collisions and precompute contact data
        this.detectCollisions(bodies);

        // 3. Pre-step constraints
        this.preStepConstraints(constraints, dt);

        // 4. Solve impulses
        this.solve(constraints);

        // 5. Integrate positions and velocities
        for (const body of bodies) {
            body.physicsUpdate(dt);
        }

        // 6. Correct positions (Baumgarte)
        this.correctPositions(constraints);

        // Emit collision:enter / collision:stay / collision:exit events
        /** @type {Map<string, Manifold>} */
        const current = new Map();
        for (const m of this.manifolds) {
            const key = m.bodyA.id < m.bodyB.id
                ? `${m.bodyA.id}:${m.bodyB.id}`
                : `${m.bodyB.id}:${m.bodyA.id}`;
            current.set(key, m);
        }

        for (const [key, m] of current) {
            /** @type {CollisionEventType} */
            const type = this._prevCollisions.has(key) ? "collision:stay" : "collision:enter";
            m.bodyA.emit(type, m);
            m.bodyB.emit(type, m);
        }

        for (const [key, m] of this._prevCollisions) {
            if (!current.has(key)) {
                m.bodyA.emit("collision:exit", m);
                m.bodyB.emit("collision:exit", m);
            }
        }

        this._prevCollisions = current;

        this.noCollide.clear();

        // Sync physics state → scene transform (includes positional corrections
        // from collision resolution applied during event handlers above)
        for (const body of bodies) {
            body.setWorldPosition(body.physPos);
            body.setWorldAngle(body.physAngle);
        }
    }
}


// Constraints


// ═══════════════════════════════════════════════════════════════
// Base Constraint
// The fundamental interface for all constraints. Constraints limit
// how bodies can move relative to each other (e.g. distance, angle).
// ═══════════════════════════════════════════════════════════════

class Constraint extends SceneNode {
    /**
     * @type {Body}
     */
    bodyA;
    /**
     * @type {Body}
     */
    bodyB;

    /**
     * @param {Body} bodyA
     * @param {Body} bodyB
     */
    constructor(bodyA, bodyB) {
        super();
        this.bodyA = bodyA;
        this.bodyB = bodyB;
    }

    /**
     * @param {number} dt
     */
    preStep(_dt) { }
    solve() { }
    correctPosition() { }

    /**
     * Returns the world-space position of a local anchor point on a body.
     * @param {Body} body
     * @param {Vector} local  Anchor in body-local space.
     * @returns {Vector}
     */
    getWorldAnchor(body, local) {
        const cos = Math.cos(body.physAngle), sin = Math.sin(body.physAngle);
        return new Vector(
            body.physPos.x + local.x * cos - local.y * sin,
            body.physPos.y + local.x * sin + local.y * cos
        );
    }

    /**
     * Converts a world-space point to body-local space.
     * @param {Body} body
     * @param {Vector} world
     * @returns {Vector}
     */
    worldToLocal(body, world) {
        const d = world.clone().sub(body.physPos);
        const cos = Math.cos(-body.physAngle), sin = Math.sin(-body.physAngle);
        return new Vector(d.x * cos - d.y * sin, d.x * sin + d.y * cos);
    }
}

// ═══════════════════════════════════════════════════════════════
// Distance Constraint (Rod / Stick)
// Keeps two points on two bodies at a fixed distance from each other.
// Useful for creating rigid bridges, pendulums, or connected structures.
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {{ bodyA: Body, bodyB: Body, localAnchorA: Vector, localAnchorB: Vector, length?: number | null }} DistanceConstraintParams
 */

class DistanceConstraint extends Constraint {
    /**
     * Anchor point in bodyA's local space.
     * @type {Vector}
     */
    localA;
    /**
     * Anchor point in bodyB's local space.
     * @type {Vector}
     */
    localB;
    /**
     * Accumulated normal impulse across solver iterations (warm-starting).
     * @type {number}
     */
    accImpulse;
    /**
     * Target distance between the two anchors in world units.
     * @type {number}
     */
    targetLength;
    /**
     * World-space position of bodyA's anchor. Computed in preStep.
     * @type {Vector}
     */
    worldA;
    /**
     * World-space position of bodyB's anchor. Computed in preStep.
     * @type {Vector}
     */
    worldB;
    /**
     * Offset from bodyA's physPos to worldA. Computed in preStep.
     * @type {Vector}
     */
    rA;
    /**
     * Offset from bodyB's physPos to worldB. Computed in preStep.
     * @type {Vector}
     */
    rB;
    /**
     * Unit vector from worldA toward worldB. Computed in preStep.
     * @type {Vector}
     */
    n;
    /**
     * Inverse of the constraint's effective mass along n. Computed in preStep.
     * @type {number}
     */
    effectiveMass;

    /**
     * @param {Body} bodyA
     * @param {Body} bodyB
     * @param {Vector} localAnchorA  Anchor in bodyA's local space.
     * @param {Vector} localAnchorB  Anchor in bodyB's local space.
     * @param {number | null} [length]  Target distance; defaults to current anchor separation.
     */
    constructor(bodyA, bodyB, localAnchorA, localAnchorB, length = null) {
        super(bodyA, bodyB);
        this.localA = localAnchorA;
        this.localB = localAnchorB;
        this.accImpulse = 0;

        if (length === null) {
            const wA = this.getWorldAnchor(bodyA, localAnchorA);
            const wB = this.getWorldAnchor(bodyB, localAnchorB);
            this.targetLength = wB.clone().sub(wA).length();
        } else {
            this.targetLength = length;
        }
    }

    /**
     * @param {number} _dt
     */
    preStep(_dt) {
        const a = this.bodyA, b = this.bodyB;
        this.worldA = this.getWorldAnchor(a, this.localA);
        this.worldB = this.getWorldAnchor(b, this.localB);
        this.rA = this.worldA.clone().sub(a.physPos);
        this.rB = this.worldB.clone().sub(b.physPos);

        const delta = this.worldB.clone().sub(this.worldA);
        const dist = delta.length();
        this.n = dist > 0.0001 ? delta.scale(1 / dist) : new Vector(1, 0);

        const rAxN = this.rA.x * this.n.y - this.rA.y * this.n.x;
        const rBxN = this.rB.x * this.n.y - this.rB.y * this.n.x;
        this.effectiveMass = a.invMass + b.invMass
            + rAxN * rAxN * a.invInertia
            + rBxN * rBxN * b.invInertia;
        if (this.effectiveMass > 0) this.effectiveMass = 1 / this.effectiveMass;

        // Warm start
        const px = this.n.x * this.accImpulse;
        const py = this.n.y * this.accImpulse;
        a.vel.x -= px * a.invMass; a.vel.y -= py * a.invMass;
        a.angVel -= (this.rA.x * py - this.rA.y * px) * a.invInertia;
        b.vel.x += px * b.invMass; b.vel.y += py * b.invMass;
        b.angVel += (this.rB.x * py - this.rB.y * px) * b.invInertia;
    }

    solve() {
        const a = this.bodyA, b = this.bodyB;
        const { rA, rB, n } = this;
        const dvx = (b.vel.x - b.angVel * rB.y) - (a.vel.x - a.angVel * rA.y);
        const dvy = (b.vel.y + b.angVel * rB.x) - (a.vel.y + a.angVel * rA.x);
        const Cdot = dvx * n.x + dvy * n.y;
        const lambda = -this.effectiveMass * Cdot;
        this.accImpulse += lambda;

        const px = n.x * lambda, py = n.y * lambda;
        a.vel.x -= px * a.invMass; a.vel.y -= py * a.invMass;
        a.angVel -= (rA.x * py - rA.y * px) * a.invInertia;
        b.vel.x += px * b.invMass; b.vel.y += py * b.invMass;
        b.angVel += (rB.x * py - rB.y * px) * b.invInertia;
    }

    correctPosition() {
        const a = this.bodyA, b = this.bodyB;
        const wA = this.getWorldAnchor(a, this.localA);
        const wB = this.getWorldAnchor(b, this.localB);
        const delta = wB.clone().sub(wA);
        const dist = delta.length();
        if (dist < 0.0001 && this.targetLength < 0.0001) return;

        const n = dist > 0.0001 ? delta.scale(1 / dist) : new Vector(1, 0);
        const C = dist - this.targetLength;
        const rA = wA.clone().sub(a.physPos);
        const rB = wB.clone().sub(b.physPos);
        const rAxN = rA.x * n.y - rA.y * n.x;
        const rBxN = rB.x * n.y - rB.y * n.x;
        let K = a.invMass + b.invMass + rAxN * rAxN * a.invInertia + rBxN * rBxN * b.invInertia;
        if (K === 0) return;

        const corr = -C / K * 0.2;
        a.physPos.x -= n.x * corr * a.invMass; a.physPos.y -= n.y * corr * a.invMass;
        b.physPos.x += n.x * corr * b.invMass; b.physPos.y += n.y * corr * b.invMass;
    }
}

// Spring

/**
 * @typedef {{ stiffness?: number, damping?: number, restLength?: number, maxForce?: number, minLength?: number, maxLength?: number }} SpringOptions
 */

class SpringConstraint extends Constraint {
    /**
     * Anchor point in bodyA's local space.
     * @type {Vector}
     */
    localA;
    /**
     * Anchor point in bodyB's local space.
     * @type {Vector}
     */
    localB;
    /**
     * Spring stiffness coefficient (N/m). Higher values produce a stiffer spring.
     * @type {number}
     */
    stiffness;
    /**
     * Damping coefficient. Higher values dissipate energy faster.
     * @type {number}
     */
    damping;
    /**
     * Maximum force magnitude applied each step. Clamps to prevent instability.
     * @type {number}
     */
    maxForce;
    /**
     * Minimum allowed distance between anchors (compression limit).
     * @type {number}
     */
    minLength;
    /**
     * Maximum allowed distance between anchors (stretch limit).
     * @type {number}
     */
    maxLength;
    /**
     * Natural rest length of the spring in world units.
     * @type {number}
     */
    restLength;
    /**
     * Cached world-space position of bodyA's anchor. Updated in applyForce().
     * @type {Vector}
     */
    worldA;
    /**
     * Cached world-space position of bodyB's anchor. Updated in applyForce().
     * @type {Vector}
     */
    worldB;

    /**
     * @param {Body} bodyA
     * @param {Body} bodyB
     * @param {Vector} localAnchorA  Anchor in bodyA's local space.
     * @param {Vector} localAnchorB  Anchor in bodyB's local space.
     * @param {SpringOptions} [options]
     */
    constructor(bodyA, bodyB, localAnchorA, localAnchorB, options = {}) {
        super(bodyA, bodyB);
        this.localA = localAnchorA;
        this.localB = localAnchorB;
        this.stiffness = options.stiffness ?? 300;
        this.damping   = options.damping   ?? 10;
        this.maxForce  = options.maxForce  ?? 50000;
        this.minLength = options.minLength ?? 0;
        this.maxLength = options.maxLength ?? Infinity;

        if (options.restLength !== undefined) {
            this.restLength = options.restLength;
        } else {
            const wA = this.getWorldAnchor(bodyA, localAnchorA);
            const wB = this.getWorldAnchor(bodyB, localAnchorB);
            this.restLength = wB.clone().sub(wA).length();
        }
        this.worldA = this.getWorldAnchor(bodyA, localAnchorA);
        this.worldB = this.getWorldAnchor(bodyB, localAnchorB);
    }

    applyForce() {
        const a = this.bodyA, b = this.bodyB;
        this.worldA = this.getWorldAnchor(a, this.localA);
        this.worldB = this.getWorldAnchor(b, this.localB);
        const delta = this.worldB.clone().sub(this.worldA);
        const dist = delta.length();
        if (dist < 0.0001) return;
        const n = delta.scale(1 / dist);

        // Clamp distance to [minLength, maxLength] before computing force
        const clampedDist = Math.max(this.minLength, Math.min(this.maxLength, dist));
        const stretch = clampedDist - this.restLength;

        // Relative velocity along the spring axis
        const rA = this.worldA.clone().sub(a.physPos);
        const rB = this.worldB.clone().sub(b.physPos);
        const vA = new Vector(a.vel.x - a.angVel * rA.y, a.vel.y + a.angVel * rA.x);
        const vB = new Vector(b.vel.x - b.angVel * rB.y, b.vel.y + b.angVel * rB.x);
        const velAlongSpring = vB.clone().sub(vA).dot(n);

        // Hooke's Law + damping
        let forceMag = this.stiffness * stretch + this.damping * velAlongSpring;

        // Extra correction if beyond hard limits
        if (dist > this.maxLength) forceMag += this.stiffness * 2 * (dist - this.maxLength);
        if (dist < this.minLength) forceMag += this.stiffness * 2 * (dist - this.minLength);

        forceMag = Math.max(-this.maxForce, Math.min(this.maxForce, forceMag));

        const fx = n.x * forceMag, fy = n.y * forceMag;
        a.applyForceAtPoint(new Vector(fx, fy), this.worldA);
        b.applyForceAtPoint(new Vector(-fx, -fy), this.worldB);
    }

    preStep(_dt) { }
    solve() { }
    correctPosition() { }
}

// ═══════════════════════════════════════════════════════════════
// Rope Constraint (Max Distance Only)
// Acts like a rope or chain. Applies an impulse only when the distance
// exceeds maxLength — slack is allowed below that limit.
// ═══════════════════════════════════════════════════════════════

class RopeConstraint extends Constraint {
    /**
     * Anchor point in bodyA's local space.
     * @type {Vector}
     */
    localA;
    /**
     * Anchor point in bodyB's local space.
     * @type {Vector}
     */
    localB;
    /**
     * Maximum allowed distance between anchors before the rope pulls tight.
     * @type {number}
     */
    maxLength;
    /**
     * Accumulated normal impulse across solver iterations (warm-starting).
     * @type {number}
     */
    accImpulse;
    /**
     * Cached world-space position of bodyA's anchor. Computed in preStep.
     * @type {Vector}
     */
    worldA;
    /**
     * Cached world-space position of bodyB's anchor. Computed in preStep.
     * @type {Vector}
     */
    worldB;
    /**
     * Offset from bodyA's physPos to worldA. Computed in preStep.
     * @type {Vector}
     */
    rA;
    /**
     * Offset from bodyB's physPos to worldB. Computed in preStep.
     * @type {Vector}
     */
    rB;
    /**
     * Unit vector from worldA toward worldB. Computed in preStep.
     * @type {Vector}
     */
    n;
    /**
     * Inverse of the constraint's effective mass along n. Computed in preStep.
     * @type {number}
     */
    effectiveMass;

    /**
     * @param {Body} bodyA
     * @param {Body} bodyB
     * @param {Vector} localAnchorA  Anchor in bodyA's local space.
     * @param {Vector} localAnchorB  Anchor in bodyB's local space.
     * @param {number | null} [maxLength]  Max distance; defaults to current anchor separation.
     */
    constructor(bodyA, bodyB, localAnchorA, localAnchorB, maxLength = null) {
        super(bodyA, bodyB);
        this.localA = localAnchorA;
        this.localB = localAnchorB;
        this.accImpulse = 0;
        if (maxLength === null) {
            const wA = this.getWorldAnchor(bodyA, localAnchorA);
            const wB = this.getWorldAnchor(bodyB, localAnchorB);
            this.maxLength = wB.clone().sub(wA).length();
        } else {
            this.maxLength = maxLength;
        }
    }

    /**
     * @param {number} _dt
     */
    preStep(_dt) {
        const a = this.bodyA, b = this.bodyB;
        this.worldA = this.getWorldAnchor(a, this.localA);
        this.worldB = this.getWorldAnchor(b, this.localB);
        this.rA = this.worldA.clone().sub(a.physPos);
        this.rB = this.worldB.clone().sub(b.physPos);

        const delta = this.worldB.clone().sub(this.worldA);
        const dist = delta.length();
        this.n = dist > 0.0001 ? delta.scale(1 / dist) : new Vector(1, 0);

        // Only active when stretched beyond max length
        if (dist <= this.maxLength) {
            this.accImpulse = 0;
            return;
        }

        const rAxN = this.rA.x * this.n.y - this.rA.y * this.n.x;
        const rBxN = this.rB.x * this.n.y - this.rB.y * this.n.x;
        this.effectiveMass = a.invMass + b.invMass
            + rAxN * rAxN * a.invInertia
            + rBxN * rBxN * b.invInertia;
        if (this.effectiveMass > 0) this.effectiveMass = 1 / this.effectiveMass;

        // Warm start
        const px = this.n.x * this.accImpulse;
        const py = this.n.y * this.accImpulse;
        a.vel.x -= px * a.invMass;
        a.vel.y -= py * a.invMass;
        a.angVel -= (this.rA.x * py - this.rA.y * px) * a.invInertia;
        b.vel.x += px * b.invMass;
        b.vel.y += py * b.invMass;
        b.angVel += (this.rB.x * py - this.rB.y * px) * b.invInertia;
    }

    solve() {
        const a = this.bodyA, b = this.bodyB;
        const { rA, rB, n } = this;

        const delta = this.getWorldAnchor(b, this.localB).sub(this.getWorldAnchor(a, this.localA));
        if (delta.length() <= this.maxLength) return;

        const dvx = (b.vel.x - b.angVel * rB.y) - (a.vel.x - a.angVel * rA.y);
        const dvy = (b.vel.y + b.angVel * rB.x) - (a.vel.y + a.angVel * rA.x);
        const Cdot = dvx * n.x + dvy * n.y;

        let lambda = -this.effectiveMass * Cdot;

        // One-sided: only pull together, never push apart
        const oldAcc = this.accImpulse;
        this.accImpulse = Math.min(0, this.accImpulse + lambda);
        lambda = this.accImpulse - oldAcc;

        const px = n.x * lambda, py = n.y * lambda;
        a.vel.x -= px * a.invMass;
        a.vel.y -= py * a.invMass;
        a.angVel -= (rA.x * py - rA.y * px) * a.invInertia;
        b.vel.x += px * b.invMass;
        b.vel.y += py * b.invMass;
        b.angVel += (rB.x * py - rB.y * px) * b.invInertia;
    }

    correctPosition() {
        const a = this.bodyA, b = this.bodyB;
        const wA = this.getWorldAnchor(a, this.localA);
        const wB = this.getWorldAnchor(b, this.localB);
        const delta = wB.clone().sub(wA);
        const dist = delta.length();
        if (dist <= this.maxLength) return;

        const n = dist > 0.0001 ? delta.scale(1 / dist) : new Vector(1, 0);
        const C = dist - this.maxLength;
        const rA = wA.clone().sub(a.physPos);
        const rB = wB.clone().sub(b.physPos);
        const rAxN = rA.x * n.y - rA.y * n.x;
        const rBxN = rB.x * n.y - rB.y * n.x;
        let K = a.invMass + b.invMass
            + rAxN * rAxN * a.invInertia
            + rBxN * rBxN * b.invInertia;
        if (K === 0) return;
        const corr = -C / K * 0.2;
        a.physPos.x -= n.x * corr * a.invMass;
        a.physPos.y -= n.y * corr * a.invMass;
        b.physPos.x += n.x * corr * b.invMass;
        b.physPos.y += n.y * corr * b.invMass;
    }
}
