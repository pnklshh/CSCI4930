class Point {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}
}

class Arc {
	constructor(left, right, focus, leftEdge, rightEdge) {
		this.left = left;
		this.right = right;
		this.focus = focus;
		this.edge = { left: leftEdge, right: rightEdge };
		this.event = null;
	}
}

class Edge {
	constructor(p1, p2, startx) {
		this.m = -(p1.x - p2.x) / (p1.y - p2.y);
		this.q = (0.5 * (Math.pow(p1.x, 2) - Math.pow(p2.x, 2) + Math.pow(p1.y, 2) - Math.pow(p2.y, 2))) / (p1.y - p2.y);
		this.arc = { left: p1, right: p2 };
		this.end = null;
		this.start = null;
		if (startx) {
			this.start = new Point(
				startx,
				this.m != Infinity ? this.getY(startx) : null
			);
		}
	}
	getY(x) {
		if (this.m == Infinity) {
			return null;
		}
		return x * this.m + this.q;
	}
	getX(y) {
		if (this.m == Infinity) {
			return this.start.x;
		}
		return (y - this.q) / this.m;
	}
}

class Event {
	constructor(type, position, caller, vertex) {
		this.type = type;
		this.caller = caller;
		this.position = position;
		this.vertex = vertex;
		this.active = true;
	}
}

// to store list of events in sorted order
class SortedQueue {
	constructor(events) {
		this.list = [];
		if (events) {
			this.list = events;
		}
		this.sort();
	}

	get length() {
		return this.list.length;
	}
	set points(events) {
		this.list = events;
		this.sort();
	}

	popFirstElement() {
		var element = this.list[0];
		this.list.splice(0, 1);
		return element;
	}

	insert(event) {
		this.list.push(event);
		this.sort();
	}

	sort() {
		this.list.sort(function (a, b) {
			var diff = a.position.y - b.position.y;
			if (diff == 0) {
				return a.position.x - b.position.x;
			}
			return diff;
		});
	}
}

class Voronoi {	
	constructor(points, width, height) {
		this.pointsLst = points;
		this.box_x = width;
		this.box_y = height;
		this.reset();
	}

	reset() {
		this.eventLst = new SortedQueue();
		this.beachlineRoot = null;
		this.voronoiVertex = [];
		this.edges = [];
	}

	update() {
		this.reset();
		var points = [];
		var event = null;
		for (const p of this.pointsLst) {
			points.push(new Event("point", p));
		}
		this.eventLst.points = points;

		while (this.eventLst.length > 0) {
			event = this.eventLst.popFirstElement();
			if (event.type == "point") {
				this.pointEvent(event.position);
			}
			else if (event.active) {
				this.circleEvent(event);
			}
		}
		this.formSegments(event.position);
	}

	
	pointEvent(p) {
		var q = this.beachlineRoot;
		if (q == null) {
			this.beachlineRoot = new Arc(null, null, p, null, null);
		}
		else {
			while (q.right != null && this.parabolaIntersection(p.y, q.focus, q.right.focus) <= p.x) {
				q = q.right;
			}

			var e_qp = new Edge(q.focus, p, p.x);
			var e_pq = new Edge(p, q.focus, p.x);

			var arc_p = new Arc(q, null, p, e_qp, e_pq);
			var arc_qr = new Arc(arc_p, q.right, q.focus, e_pq, q.edge.right);
			if (q.right){
				q.right.left = arc_qr;
			} 
			arc_p.right = arc_qr;
			q.right = arc_p;
			q.edge.right = e_qp;

			if (q.event) {
				q.event.active = false;
			}

			this.addCircleEvent(p, q);
			this.addCircleEvent(p, arc_qr);

			this.edges.push(e_qp);
			this.edges.push(e_pq);
		}
	}

	
	circleEvent(e) {
		var arc = e.caller;
		var p = e.position;
		var edge_new = new Edge(arc.left.focus, arc.right.focus);

		if (arc.left.event) {
			arc.left.event.active = false;
		}
		if (arc.right.event) {
			arc.right.event.active = false;
		}

		arc.left.edge.right = edge_new;
		arc.right.edge.left = edge_new;
		arc.left.right = arc.right;
		arc.right.left = arc.left;

		this.edges.push(edge_new);

		if (!this.IsPointOutside(e.vertex)) {
			this.voronoiVertex.push(e.vertex);
		}
		arc.edge.left.end = arc.edge.right.end = edge_new.start = e.vertex;

		this.addCircleEvent(p, arc.left);
		this.addCircleEvent(p, arc.right);
	}

	addCircleEvent(p, arc) {
		if (arc.left && arc.right) {
			var a = arc.left.focus;
			var b = arc.focus;
			var c = arc.right.focus;

			// Positive denotes intersection of edges
			if ((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y) > 0) {
				var new_inters = this.edgeIntersection(
					arc.edge.left,
					arc.edge.right
				);
				var circle_radius = Math.sqrt((new_inters.x - arc.focus.x) ** 2 + (new_inters.y - arc.focus.y) ** 2);
				var event_pos = circle_radius + new_inters.y;
				if (event_pos > p.y && new_inters.y < this.box_y) {
					var event = new Event(
						"circle",
						new Point(new_inters.x, event_pos),
						arc,
						new_inters
					);
					arc.event = event;
					this.eventLst.insert(event);
				}
			}
		}
	}

	parabolaIntersection(y, f1, f2) {
		var fyDiff = f1.y - f2.y;
		if (fyDiff == 0){
			return (f1.x + f2.x) / 2;
		}
		var fxDiff = f1.x - f2.x;
		var b1md = f1.y - y; 
		var b2md = f2.y - y; 
		var h1 = (-f1.x * b2md + f2.x * b1md) / fyDiff;
		var h2 = Math.sqrt(b1md * b2md * (fxDiff ** 2 + fyDiff ** 2)) / fyDiff;
		var h = h1 + h2;
		return h;
	}

	edgeIntersection(e1, e2) {
		if (e1.m == Infinity) {
			return new Point(e1.start.x, e2.getY(e1.start.x));
		} 
		else if (e2.m == Infinity) {
			return new Point(e2.start.x, e1.getY(e2.start.x));
		}
		else {
			var mdif = e1.m - e2.m;
			if (mdif == 0) {
				return null;
			}
			var x = (e2.q - e1.q) / mdif;
			var y = e1.getY(x);
			return new Point(x, y);
		}
	}

	formSegments(last) {
		var r = this.beachlineRoot;
		var edge, x, y;
		while (r.right) {
			edge = r.edge.right;
			x = this.parabolaIntersection(last.y * 1.1, edge.arc.left, edge.arc.right);
			y = edge.getY(x);

			if (
				(edge.start.y < 0 && y < edge.start.y) ||
				(edge.start.x < 0 && x < edge.start.x) ||
				(edge.start.x > this.box_x && x > edge.start.x)
			) {
				edge.end = edge.start;
			} 
			else {
				if (edge.m == 0) {
					x - edge.start.x <= 0 ? (x = 0) : (x = this.box_x);
					edge.end = new Point(x, edge.start.y);
					this.voronoiVertex.push(edge.end);
				} 
				else {
					if (edge.m == Infinity) {
						y = this.box_y;
					}
					else{
						edge.m * (x - edge.start.x) <= 0 ? (y = 0) : (y = this.box_y);
					}
					edge.end = this.edgeEnd(edge, y);
				}
			}
			r = r.right;
		}

		var option;

		for (var i = 0; i < this.edges.length; i++) {
			edge = this.edges[i];
			option = this.IsPointOutside(edge.start) + this.IsPointOutside(edge.end) * 2;
			if (option == 1) {
				if (edge.start.y < edge.end.y) {
					y = 0;
				} 
				else {
					y = this.box_y;
				}
				edge.start = this.edgeEnd(edge, y);
			}
			else if (option == 2) {
				if (edge.end.y < edge.start.y) {
					y = 0;
				} 
				else {
					y = this.box_y;
				}
				edge.end = this.edgeEnd(edge, y);
			}
			else if (option == 3) {
				this.edges[i] = null;
			}
		}
	}

	edgeEnd(edge, y_lim) {
		var max = Math.max(0, edge.getX(y_lim))
		var x = Math.min(this.box_x, max);
		var y = edge.getY(x);
		if (!y) {
			y = y_lim;
		}
		var p = new Point(x, y);
		this.voronoiVertex.push(p);
		return p;
	}

	IsPointOutside(p) {
		return p.x < 0 || p.x > this.box_x || p.y < 0 || p.y > this.box_y;
	}
}




var points = [];
var voronoi, canvas, svg; 

(function () {
	svg = document.getElementById("canvas");
    voronoi = new Voronoi(points, svg.width.baseVal.value, svg.height.baseVal.value);    
    canvas = new SVG_Graphics(svg);
})();

function reset() {
    points = [];
    voronoi.pointsLst = [];
    svg.textContent = '';
};

function addPoint(event) {
    var x = event.offsetX;
    var y = event.offsetY;

    var add = true;
    for (const p of points) {
        var d = Math.sqrt(Math.pow((x-p.x), 2) + Math.pow((y-p.y), 2));
        if (d < 3) {
            add = false;
        }
    }
    if (add) {
        points.push(new Point(x, y));
    }
    voronoi.pointsLst = points;
    console.log(points);
    voronoi.update();
    canvas.draw(points,voronoi.voronoiVertex,voronoi.edges);
};