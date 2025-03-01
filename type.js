let rect = d3.select("#container").node().getBoundingClientRect();
let rect2 = d3.select("td").node().getBoundingClientRect();
let spacing = window.getComputedStyle(d3.select("table").node()).borderSpacing.replaceAll("px", "").split(" ");
d3.select("#table")
    .style("left", (rect.width / 2 - rect2.width / 2 - spacing[0]) + "px")
    .style("top", (rect.height / 2 - rect2.height / 2 - spacing[1]) + "px");
d3.select("#blur-top")
    .style("height", (rect.height / 2 - rect2.height / 2 - spacing[1] / 3) + "px");
d3.select("#blur-bottom")
    .style("height", (rect.height / 2 - rect2.height / 2 + spacing[1] / 6) + "px");
d3.select("#blur-left")
    .style("width", (rect.width / 2 - rect2.width / 2 - spacing[0] / 3) + "px")
    .style("height", (rect2.height / 1 + spacing[1] / 6) + "px")
    .style("top", (rect.height / 2 - rect2.height / 2 - spacing[1] / 3) + "px");
d3.select("#blur-right")
    .style("width", (rect.width / 2 - rect2.width / 2 - spacing[0] / 3) + "px")
    .style("height", (rect2.height / 1 + spacing[1] / 6) + "px")
    .style("top", (rect.height / 2 - rect2.height / 2 - spacing[1] / 3) + "px");

blocks = [];
d3.csv("dev/blocks.csv").then(data => {
    blocks = data;
});

var mode = 0;
var row = 0;
var col = 0;
document.addEventListener("keydown", function(event) {
    if (mode == 0) {
        if ("gfdsahjklmtrewqyuiopnbvcx".includes(event.key)) {
            mode = 1;
            row = "gfdsahjklmtrewqyuiopnbvcx".indexOf(event.key);
            col = "qawsxedcrfvtgbyhnujmikolp-[=]".indexOf(event.key);
            d3.select("#table")
                .transition()
                .duration(1000)
                .style("top", (rect.height / 2 - rect2.height / 2 - spacing[1] - row * (rect2.height / 1 + spacing[1] / 2)) + "px")
                .style("left", (rect.width / 2 - rect2.width / 2 - spacing[0] - col * (rect2.width / 1 + spacing[0] / 1)) + "px");
        }
    } else if (mode == 1) {
        if ("qawsxedcrfvtgbyhnujmikolp-[=]".includes(event.key)) {
            col = "qawsxedcrfvtgbyhnujmikolp-[=]".indexOf(event.key);
            d3.select("#table")
                .transition()
                .duration(1000)
                .style("left", (rect.width / 2 - rect2.width / 2 - spacing[0] - col * (rect2.width / 1 + spacing[0] / 1)) + "px");
        }
    }
    if ("123456780".includes(event.key)) {
        mode = 0;
        ind = "123456780".indexOf(event.key);
        if (ind < 8) {
            console.log(blocks[row * 29 + col]["chars"][ind]);
            document.getElementById("footer-text").innerHTML += blocks[row * 29 + col]["chars"][ind];
        }
    }
});