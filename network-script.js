// code originally taken from https://bl.ocks.org/puzzler10/4438752bb93f45dc5ad5214efaa12e4a

function runSimulation (data) {

    //create somewhere to put the force directed graph
    var svg = d3.select("svg"),
        width = +svg.attr("width"),
        height = +svg.attr("height");

    // clear any existing graph
    svg.selectAll("*").remove();

    // node radius in pixels
    var radius = 10; 

    //
    // Set up the simulation and add forces
    //
    
    let simulation = d3.forceSimulation()
        .nodes(data.nodes);

    let link_force =  d3.forceLink(data.links)
        .id(d => d.info.stub);            

    let charge_force = d3.forceManyBody()
        .strength(-100); 

    let center_force = d3.forceCenter(width / 2, height / 2);

    simulation
        .force("charge_force", charge_force)
        .force("center_force", center_force)
        .force("links",link_force)
    ;

    //add tick instructions: 
    simulation.on("tick", tickActions );

    //add encompassing group for the zoom 
    var g = svg.append("g")
        .attr("class", "everything");

    //draw lines for the links 
    var link = g.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(data.links)
        .enter().append("line")
        .attr("stroke-width", d => Math.sqrt(Math.sqrt(d.value)))
        .style("stroke", linkColour);        

    //draw circles for the nodes 
    var node = g.append("g")
        .attr("class", "nodes") 
        .selectAll("circle")
        .data(data.nodes)
        .enter()
        .append("circle")
        .attr("r", radius)
        .attr("fill", circleColour);

    // Show full name on mouseover
    node.append("title")
        .text(d => d.info.name);

    //add drag capabilities  
    var drag_handler = d3.drag()
        .on("start", drag_start)
        .on("drag", drag_drag)
        .on("end", drag_end);	

    drag_handler(node);

    node.on("click tap", node => {
        console.log(node.info.stub);
    });


    //add zoom capabilities 
    var zoom_handler = d3.zoom()
        .on("zoom", zoom_actions);

    zoom_handler(svg);     

    /** Functions **/

    //Function to choose what color circle we have
    //Let's return blue for males and red for females
    function circleColour(d){
        const colors = {
            local: "red",
            regional: "orange",
            international: "blue",
            unknown: "grey"
        }
        return colors[d.info.scope];
    }

    //Function to choose the line colour and thickness 
    //If the link type is "A" return green 
    //If the link type is "E" return red 
    function linkColour(d){
        return "grey";
    }

    //Drag functions 
    //d is the node 
    function drag_start(d) {
        if (!d3.event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    //make sure you can't drag the circle outside the box
    function drag_drag(d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
    }

    function drag_end(d) {
        if (!d3.event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    //Zoom functions 
    function zoom_actions(){
        g.attr("transform", d3.event.transform)
    }

    function tickActions() {
        //update circle positions each tick of the simulation 
        node
            .attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; });

        //update link positions 
        link
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });
    }

    console.log(g);

}


const KEYS = {
    Both: "all",
    "3W": "3w",
    IATI: "iati"
};

function transformData (orgs, source, humanitarian_only) {
    const key = KEYS[source];
    let links = [], orgsUsed = {};
    
    Object.values(orgs).forEach(org => {
        if (org.info.skip) {
            return;
        }
        for (var scope in org.partners[key]) {
            Object.keys(org.partners[key][scope]).forEach(stub => {
                let partner = orgs[stub];
                if (partner.info.stub <= org.info.stub || partner.info.skip) {
                    return;
                }

                // if the source param isn't null, then both orgs must include that source
                // FIXME (that doesn't mean that the relationship is in the source, though)
                if (source !== "Both" && !(org.sources.includes(source) && partner.sources.includes(source))) {
                    return;
                }

                // if the humanitarian_only param is true, then both orgs must be humanitarian
                if (humanitarian_only && !(org.humanitarian && partner.humanitarian)) {
                    return;
                }

                links.push({
                    source: org.info.stub,
                    target: partner.info.stub,
                    value: org.partners[key][scope][stub]
                });
                orgsUsed[org.info.stub] = org;
                orgsUsed[partner.info.stub] = partner;
            });
        }
    });

    // Return data in a format usable by d3.forceSimulation() 
    return {
        nodes: Object.values(orgsUsed),
        links: links
    };
}

/**
 * Attempt to fit the viz to the visible area
 */
function fitViz () {
    const svg = d3.select("svg");
    const g = svg.select("g");
    
    const width = svg.attr("width");
    const height = svg.attr("height");
    const bounds = g.node().getBBox();

    const scale = .25;

    g.transition().duration(500).attr(
        "transform",
        "translate(" + width/2 + "," + height/2 + ")"
            + " scale(" + scale + ")"
            + " translate(" + -(width/bounds.width) + "," + -(height/bounds.height) + ")"
    );
}

/**
 * (Re)draw the visualisation
 */
function drawViz (orgIndex, source, humanitarian_only) {
    let data = transformData(orgIndex, source, humanitarian_only);
    runSimulation(data);
    fitViz();
}


// Load JSON then render

const promise = fetch("https://davidmegginson.github.io/iati3w-data/org-index.json");

promise.then(result => {
    let formNode = document.getElementById("filter");
    result.json().then(orgIndex => {
        formNode.addEventListener("change", event => {
            let source = formNode.elements.source.value;
            let humanitarian_only = formNode.elements.humanitarian_only.checked;
            drawViz(orgIndex, source, humanitarian_only);
        });
        drawViz(orgIndex, "Both", false);
    });
});

