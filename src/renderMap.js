d3.select(window).on("resize", throttle);

var zoom = d3.zoom()
    .scaleExtent([1, 9])
    .on("zoom", move);

var c = document.getElementById('container');
var width = c.offsetWidth;
var height = width / 3 * 2;

const margin = {left: 30, right: 15, top: 15, bottom: 18};
let innerWidth = width - margin.left - margin.right;
let innerHeight = height / 5 - margin.top - margin.bottom;

//offsets for tooltips
var offsetL = c.offsetLeft + 20;
var offsetT = c.offsetTop + 10;

var topo, projection, path, svg, g, gpoint, wholeData;

var graticule = d3.geoGraticule();

var tooltip = d3.select("#container").append("div").attr("class", "tooltip hidden");

const rScale = d3.scaleSqrt();

const x = d3.scaleTime()
    .domain([new Date(1944, 12, 31), new Date(1998, 12, 31)])
    .range([0, innerWidth])
    .nice(d3.timeYear);

const brush = d3.brushX();


setup(width, height);

function setup(width, height) {
    //projection = d3.geo.mercator()
    projection = d3.geoMercator()
        .translate([(width / 2), (height / 2)])
        .scale(width / 2 / Math.PI);

    //path = d3.geo.path().projection(projection);
    path = d3.geoPath().projection(projection);

    svg = d3.select("#container").append("svg")
        .attr("width", width)
        .attr("height", height)
        .call(zoom)
        //.on("click", click)
        .append("g");

    g = svg.append("g")
        .on("click", click);
}

d3.json("data/world-topo-min.json", function (error, world) {

    var countries = topojson.feature(world, world.objects.countries).features;

    topo = countries;
    draw(topo);

});

function handleMouseOver() {
    var mouse = d3.mouse(svg.node()).map(function (d) {
        return parseInt(d);
    });

    tooltip.classed("hidden", false)
        .attr("style", "left:" + (mouse[0] + offsetL) + "px;top:" + (mouse[1] + offsetT) + "px")
        .html(this.__data__.properties.name);
}

function handleMouseOut() {
    tooltip.classed("hidden", true);
}


function draw(topo) {

    svg.append("path")
        .datum(graticule)
        .attr("class", "graticule")
        .attr("d", path);

    g.append("path")
        .datum({type: "LineString", coordinates: [[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]]})
        .attr("class", "equator")
        .attr("d", path);

    var country = g.selectAll(".country").data(topo);

    country.enter().insert("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("id", function (d, i) {
            return d.id;
        })
        .attr("title", function (d, i) {
            return d.properties.name;
        })
        .style("fill", function (d, i) {
            return d.properties.color;
        })
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut);

    gpoint = g.append("g").attr("class", "gpoint");
    renderBar();
}

function drawPoints(data) {

    rScale
        .domain(d3.extent(data, function (d) {
            return d.yield_1;
        }))
        .range([4, 22]);

    const circles = gpoint.selectAll('.point').data(data);
    circles.enter().append('circle')
        .attr('class', 'point')
        .merge(circles)
        .attr('cx', function (d) {
            return projection([d.longitude, d.latitude])[0]
        })
        .attr('cy', function (d) {
            return projection([d.longitude, d.latitude])[1]
        })
        .attr('r', function (d) {
            return rScale(d.yield_1)
        })
        .attr('fill', 'black')
        .attr('fill-opacity', 0.55)
        .attr('text', function (d) {
            return d.country
        });
    circles.exit().remove();
}


function redraw() {
    width = c.offsetWidth;
    height = width / 3 * 2;
    innerWidth = width - margin.left - margin.right;
    innerHeight = height / 5 - margin.top - margin.bottom;
    x.range([0, innerWidth]);
    d3.selectAll('svg').remove();
    setup(width, height);
    draw(topo);
}


function move() {

    //var t = d3.event.translate;
    const t = [d3.event.transform.x, d3.event.transform.y];

    //var s = d3.event.scale;
    const s = d3.event.transform.k;

//        zscale = s;
    const h = height / 4;

    t[0] = Math.min(
        (width / height) * (s - 1),
        Math.max(width * (1 - s), t[0])
    );
    // to prevent move too much to left which makes the left border have a positive longitude
    t[0] = Math.min(t[0], 0);

    t[1] = Math.min(
        h * (s - 1) + h * s,
        Math.max(height * (1 - s) - h * s, t[1])
    );
    //zoom.translateBy(t);
    g.attr("transform", "translate(" + t + ")scale(" + s + ")");

    //adjust the country hover stroke width based on zoom level
    d3.selectAll(".country").style("stroke-width", 1.5 / s);


    const leftUp = projection.invert([-t[0] / s, -t[1] / s]);
    const rightDown = projection.invert([(-t[0] + width) / s, (-t[1] + height) / s]);
    const d = wholeData.filter(function (d) {
        return (d.latitude > rightDown[1] && d.latitude < leftUp[1] && d.longitude < rightDown[0] && d.longitude > leftUp[0]);
    });
//        console.log(d);
    nestByYear(d);
}

var throttleTimer;

function throttle() {
    window.clearTimeout(throttleTimer);
    throttleTimer = window.setTimeout(function () {
        redraw();
    }, 1);
}


//geo translation on mouse click in map
function click() {
    var latlon = projection.invert(d3.mouse(this));

//        console.log(d3.mouse(this));
}


const row = d => {
    return {
        year: +d['year'],
        country: d['country'],
        date_long: d['date_long'],
        longitude: +d['longitude'],
        latitude: +d['latitude'],
        yield_1: +d['yield_1']
    };
};

function renderBar() {
    d3.csv("data/sipri-report-explosions.csv", row, preprocessing);
}

function preprocessing(data) {
    wholeData = data;
    nestByYear(data);
}


function nestByYear(data) {
    drawPoints(data, [new Date(1944, 12, 31), new Date(1998, 12, 31)]);

    const year_formater = d3.timeFormat("%Y"),
        toDate = function (d) {
            const day = d.date_long;
            return day.slice(0, 4) + "-" + day.slice(4, 6) + "-" + day.slice(6, 8)
        },
        toYear = function (d) {
            return year_formater(new Date(toDate(d)))
        };

    const explosionsByYear = d3.nest()
        .key(toYear)
        .sortKeys(d3.ascending)
        .rollup(function (values) {
            return {
                amount: values.length
            }
        })
        .entries(data);

    drawBar(explosionsByYear);
}

function drawBar(data) {

    d3.selectAll('#container2 svg').remove();

    barChart = d3.select("#container2").append("svg")
        .attr('width', width)
        .attr('height', height / 5);

    g2 = barChart.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    brush.extent([[margin.left, margin.top], [innerWidth + margin.left, innerHeight + margin.top]])
        .on("brush end", brushed);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, function (d) {
            return d.value.amount;
        })])
        .range([innerHeight, 0]);

    const xAxis = d3.axisBottom(x),
        yAxis = d3.axisLeft(y);

    const yAxisG = g2.append("g")
        .attr("class", "axis axis--y")
        .call(yAxis);

    const xAxisG = g2.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + innerHeight + ")")
        .call(xAxis);

    barChart.append('g')
        .attr('class', 'brush')
        .call(brush);
//            .call(brush.move(), x.range());

    const bar = g2.selectAll('rect').data(data);

    bar.enter().append('rect')
        .attr('width', (innerWidth / 55 / 1.2))
        .attr('fill', 'steelblue')
        .merge(bar)
        .attr('x', function (data) {
            return x(new Date(data.key + "-08-01"))
        })
        .attr('y', function (data) {
            return y(data.value.amount)
        })
        .attr('height', data => innerHeight - y(data.value.amount));

    bar.exit().remove();

    yAxisG.call(y);
    xAxisG.call(x)
}

function brushed() {
    if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
    const s = d3.event.selection || x.range();
//        console.log(s.map(x.invert, x));
    period = s.map(x.invert);
    upDatePoint(period);
}

function upDatePoint(boundry) {

    const formatter = d3.timeFormat("%Y%m%d");

    const data = wholeData.filter(function (d) {
        return (d.date_long >= formatter(boundry[0]) && d.date_long <= formatter(boundry[1]))
    });
    drawPoints(data);
}