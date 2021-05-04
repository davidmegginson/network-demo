// code originally taken from https://bl.ocks.org/puzzler10/4438752bb93f45dc5ad5214efaa12e4a

function runSimulation (data) {

    //create somewhere to put the force directed graph
    var svg = d3.select("svg"),
        width = +svg.attr("width"),
        height = +svg.attr("height");

    svg.selectAll("*").remove();

    var radius = 10; 

    //set up the simulation and add forces  
    var simulation = d3.forceSimulation()
        .nodes(data.nodes);

    var link_force =  d3.forceLink(data.links)
        .id(d => d.info.stub);            

    var charge_force = d3.forceManyBody()
        .strength(-100); 

    var center_force = d3.forceCenter(width / 2, height / 2);

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
        if(d.type == "A"){
            return "green";
        } else {
            return "red";
        }
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

    return svg;
}


function transformData (orgs, source, humanitarian_only) {
    let links = [], orgsUsed = {};
    Object.values(orgs).forEach(org => {
        if (org.info.skip) {
            return;
        }
        for (var scope in org.partners) {
            Object.keys(org.partners[scope]).forEach(stub => {
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
                    value: org.partners[scope][stub]
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

function drawViz (orgIndex, source, humanitarian_only) {
    let data = transformData(orgIndex, source, humanitarian_only);
    let svg = runSimulation(data);
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

