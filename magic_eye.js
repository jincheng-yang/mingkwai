let rect = d3.select("#magic_eye").node().getBoundingClientRect();
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

var row = 19;
var col = 14;
var tableFrom = (rect.height / 2 - rect2.height / 2 - spacing[1] - 24 * (rect2.height / 1 + spacing[1] / 1));
var tableTo = (rect.height / 2 - rect2.height / 2 - spacing[1] - row * (rect2.height / 1 + spacing[1] / 1));
d3.select("#table")
    .style("top", tableTo + "px")
    .style("left", (rect.width / 2 - rect2.width / 2 - spacing[0] - col * (rect2.width / 1 + spacing[0] / 1)) + "px");
var largeFrom = Math.PI * 2 * 4 / 5;
var largeTo = Math.PI * 2 * 3 / 5;
var mediumFrom = Math.PI * 2 * 3 / 5;
var mediumTo = Math.PI * 2 * 4 / 5;
var ind = 0;
var flag = false;

document.addEventListener("keydown", function(event) {
    // console.log(event.key);
    if (flag) return;
    key = event.key;
    if (!event.shiftKey) flag = true;
    new_row = "GFDSAHJKLMTREWQYUIOPNBVCX".indexOf(key);
    if (new_row != -1) {
        if (new_row != row) {
            tableFrom = (rect.height / 2 - rect2.height / 2 - spacing[1] - row * (rect2.height / 1 + spacing[1] / 1));
            tableTo = (rect.height / 2 - rect2.height / 2 - spacing[1] - new_row * (rect2.height / 1 + spacing[1] / 1));
            largeFrom = Math.PI * 2 / 5 * Math.floor(row / 5);
            largeTo = Math.PI * 2 / 5 * Math.floor(new_row / 5);
            mediumFrom = Math.PI * 2 / 5 * (row % 5);
            mediumTo = Math.PI * 2 / 5 * (new_row % 5);
            console.log(largeFrom, largeTo);
            row = new_row;
            d3.select("#table")
                .transition()
                .duration(1000)
                .style("top", tableTo + "px");
        }
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
        new_char = blocks[row * 28 + col]["chars"][ind];
        if (!new_char) {
            new_char = "　";
        }
        d3.select("#text")
            .transition()
            .duration(100)
            .style("padding-top", "10px")
        document.getElementById("text").innerHTML += new_char;
    }
});


document.addEventListener("keyup", function(event) {
    flag = false;
    ind = "12345678".indexOf(key);
    if (ind != -1) {
        d3.select("#text")
            .transition()
            .duration(100)
            .style("padding-top", "0px")
    }
});
