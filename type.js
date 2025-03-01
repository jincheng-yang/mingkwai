let rect = d3.select("#container").node().getBoundingClientRect();
let rect2 = d3.select("td").node().getBoundingClientRect();
let spacing = window.getComputedStyle(d3.select("table").node()).borderSpacing.replaceAll("px", "").split(" ");
d3.select("#table")
    .style("left", (rect.width / 2 - rect2.width / 2 - spacing[0]) + "px")
    .style("top", (rect.height / 2 - rect2.height / 2 - spacing[1]) + "px");
d3.select("#blur-top")
    .style("height", (rect.height / 2 - rect2.height / 2 - spacing[1] / 3) + "px");
d3.select("#blur-bottom")
    .style("height", (rect.height / 2 - rect2.height / 2 - spacing[1] / 3) + "px");
d3.select("#blur-left")
    .style("width", (rect.width / 2 - rect2.width / 2 - spacing[0] / 3) + "px")
    .style("height", (rect2.height / 1 + 2 * spacing[1] / 3) + "px")
    .style("top", (rect.height / 2 - rect2.height / 2 - spacing[1] / 3) + "px");
d3.select("#blur-right")
    .style("width", (rect.width / 2 - rect2.width / 2 - spacing[0] / 3) + "px")
    .style("height", (rect2.height / 1 + 2 * spacing[1] / 3) + "px")
    .style("top", (rect.height / 2 - rect2.height / 2 - spacing[1] / 3) + "px");

blocks = [];
d3.csv("dev/wubi06.csv").then(data => {
    blocks = data;
});

var row = 0;
var col = 0;
document.addEventListener("keydown", function(event) {
    // console.log(event.key);
    key = event.key;
    new_row = "GFDSAHJKLMTREWQYUIOPNBVCX".indexOf(key);
    if (new_row != -1) {
        row = new_row;
        d3.select("#table")
            .transition()
            .duration(1000)
            .style("top", (rect.height / 2 - rect2.height / 2 - spacing[1] - row * (rect2.height / 1 + spacing[1] / 1)) + "px");
    }
    new_col = "qazwsxedcrfvtgbyhnujmikolp[]".indexOf(key);
    if (new_col != -1) {
        col = new_col;
        d3.select("#table")
            .transition()
            .duration(1000)
            .style("left", (rect.width / 2 - rect2.width / 2 - spacing[0] - col * (rect2.width / 1 + spacing[0] / 1)) + "px");
    }
    ind = "12345678".indexOf(key);
    if (ind != -1) {
        document.getElementById("footer-text").innerHTML += blocks[row * 28 + col]["chars"][ind];
    }
});