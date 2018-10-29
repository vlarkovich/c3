import CLASS from './class';
import { ChartInternal } from './core';
import { isDefined, isEmpty, getOption } from './util';

ChartInternal.prototype.initLegend = function () {
    var $$ = this;
    $$.legendItemTextBox = {};
    $$.legendHasRendered = false;
    $$.legendTitleHeight = 0;
    $$.legend = $$.svg.append("g").attr("transform", $$.getTranslate('legend'));
    if (!$$.config.legend_show) {
        $$.legend.style('visibility', 'hidden');
        $$.hiddenLegendIds = $$.mapToIds($$.data.targets);
        return;
    }
    // MEMO: call here to update legend box and tranlate for all
    // MEMO: translate will be upated by this, so transform not needed in updateLegend()
    $$.updateLegendWithDefaults();
};
ChartInternal.prototype.updateLegendWithDefaults = function () {
    var $$ = this;
    $$.updateLegend($$.mapToIds($$.data.targets), {withTransform: false, withTransitionForTransform: false, withTransition: false});
};
ChartInternal.prototype.updateSizeForLegend = function (legendHeight, legendWidth) {
    var $$ = this, 
    config = $$.config, 
    insetLegendPosition = {
        top: $$.isLegendInsetTop ? $$.getCurrentPaddingTop() + config.legend_inset_y : $$.currentHeight - legendHeight - $$.getCurrentPaddingBottom() - config.legend_inset_y,
        left: $$.isLegendInsetLeft ? $$.getCurrentPaddingLeft() + config.legend_inset_x : $$.currentWidth - legendWidth - $$.getCurrentPaddingRight() - config.legend_inset_x
    }, x, y;

    if ($$.isLegendLeft) {
        x = 0;
    } else if ($$.isLegendRight) {
        x = $$.currentWidth - legendWidth;
    } else if ($$.isLegendInset) {
        x = insetLegendPosition.left;
    } else {
        x = ($$.currentWidth - legendWidth) / 2;
    }

    if ($$.isLegendLeft || $$.isLegendRight) {
        y = ($$.currentHeight - legendHeight) / 2;
    } else if ($$.isLegendTop) {
        y = $$.getCurrentPaddingTop();
    } else if ($$.isLegendInset) {
        y = insetLegendPosition.top;
    } else {
        y = $$.currentHeight - legendHeight - $$.getCurrentPaddingBottom();
    }

    $$.margin3 = {
        top: y < 0 ? 0 : y,
        right: NaN,
        bottom: 0,
        left: x < 0 ? 0 : x
    };
};
ChartInternal.prototype.transformLegend = function (withTransition) {
    var $$ = this;
    (withTransition ? $$.legend.transition() : $$.legend).attr("transform", $$.getTranslate('legend'));
};
ChartInternal.prototype.getLegendWidth = function () {
    var $$ = this;

    if ($$.config.legend_show) {
        return Math.max(!$$.isLegendHorizontal || $$.isLegendInset ? $$.legendItemMaxWidth * ($$.legendStep + 1) : $$.legendLength, $$.legendTitleWidth || 0);
    }

    return 0;
};
ChartInternal.prototype.getLegendHeight = function () {
    var $$ = this;

    if ($$.config.legend_show) {
        return (!$$.isLegendHorizontal || $$.isLegendInset ? $$.legendLength : $$.legendItemMaxHeight * ($$.legendStep + 1)) + ($$.legendTitleHeight || 0);
    }

    return 0;
};
ChartInternal.prototype.opacityForLegend = function (legendItem) {
    return legendItem.classed(CLASS.legendItemHidden) ? null : 1;
};
ChartInternal.prototype.opacityForUnfocusedLegend = function (legendItem) {
    return legendItem.classed(CLASS.legendItemHidden) ? null : 0.3;
};
ChartInternal.prototype.toggleFocusLegend = function (targetIds, focus) {
    var $$ = this;
    targetIds = $$.mapToTargetIds(targetIds);
    $$.legend.selectAll('.' + CLASS.legendItem)
        .filter(function (id) { return targetIds.indexOf(id) >= 0; })
        .classed(CLASS.legendItemFocused, focus)
      .transition().duration(100)
        .style('opacity', function () {
            var opacity = focus ? $$.opacityForLegend : $$.opacityForUnfocusedLegend;
            return opacity.call($$, $$.d3.select(this));
        });
};
ChartInternal.prototype.revertLegend = function () {
    var $$ = this, d3 = $$.d3;
    $$.legend.selectAll('.' + CLASS.legendItem)
        .classed(CLASS.legendItemFocused, false)
        .transition().duration(100)
        .style('opacity', function () { return $$.opacityForLegend(d3.select(this)); });
};
ChartInternal.prototype.showLegend = function (targetIds) {
    var $$ = this, config = $$.config;
    if (!config.legend_show) {
        config.legend_show = true;
        $$.legend.style('visibility', 'visible');
        if (!$$.legendHasRendered) {
            $$.updateLegendWithDefaults();
        }
    }
    $$.removeHiddenLegendIds(targetIds);
    $$.legend.selectAll($$.selectorLegends(targetIds))
        .style('visibility', 'visible')
        .transition()
        .style('opacity', function () { return $$.opacityForLegend($$.d3.select(this)); });
};
ChartInternal.prototype.hideLegend = function (targetIds) {
    var $$ = this, config = $$.config;
    if (config.legend_show && isEmpty(targetIds)) {
        config.legend_show = false;
        $$.legend.style('visibility', 'hidden');
    }
    $$.addHiddenLegendIds(targetIds);
    $$.legend.selectAll($$.selectorLegends(targetIds))
    .style('opacity', 0)
    .style('visibility', 'hidden');
    $$.updateLegendWithDefaults();
};
ChartInternal.prototype.clearLegendItemTextBoxCache = function () {
    this.legendItemTextBox = {};
};
ChartInternal.prototype.updateLegend = function (targetIds, options, transitions) {
    var $$ = this, config = $$.config;
    var xForLegend, xForLegendText, xForLegendRect, yForLegend, yForLegendText, yForLegendRect, x1ForLegendTile, x2ForLegendTile, yForLegendTile;
    var textPaddingRight = 5, maxWidth = 0, maxHeight = 0, minRowMargin = 0, tilePaddingRight = 5, tilePaddingLeft = 5, 
        itemPaddingBottom = 2, itemPaddingTop = 4, titlePadding = 3;
    var l, itemsOffsets = {}, itemsWidths = {}, itemsHeights = {}, rowsMargins = [0], rowsIndexes = {}, rowIndex = 0;
    var withTransition, withTransitionForTransform;
    var texts, rects, tiles, background, legendTitle, legendTitleTextBox;
    var minMargin = null, legendAreaLength;
    var totalRowLength = 0;

    // Skip elements when their name is set to null
    targetIds = targetIds.filter(function(id) {
        return !isDefined(config.data_names[id]) || config.data_names[id] !== null;
    });

    options = options || {};
    withTransition = getOption(options, "withTransition", true);
    withTransitionForTransform = getOption(options, "withTransitionForTransform", true);

    function getTextBox(textElement, id) {
        if (!$$.legendItemTextBox[id]) {
            $$.legendItemTextBox[id] = $$.getTextRect(textElement.textContent, CLASS.legendItemText, textElement);
        }
        return $$.legendItemTextBox[id];
    }

    function updateItemPosition(textElement, id, index) {
        var reset = index === 0,
            box = getTextBox(textElement, id),
            itemWidth = tilePaddingLeft + config.legend_item_tile_width + tilePaddingRight + box.width + textPaddingRight + config.legend_padding,
            itemHeight = itemPaddingTop + Math.max(box.height, config.legend_item_tile_height || 0) + itemPaddingBottom + config.legend_padding,
            itemLength, rowMargin, maxLength;

        if (!$$.isLegendHorizontal || $$.isLegendInset) {
            itemLength = itemHeight;
        } else {
            itemLength = itemWidth;
        }

        // MEMO: care about condition of step, totalLength
        function updateValues(id, withoutRowChange) {
            if (!withoutRowChange) {
                rowMargin = (legendAreaLength - totalRowLength - itemLength) / 2;
                if (rowMargin < minRowMargin) {
                    rowMargin = (legendAreaLength - itemLength) / 2;
                    rowIndex++;
                    $$.legendStep = rowIndex;
                    totalRowLength = 0;
                }
            }
            
            rowsIndexes[id] = rowIndex;
            rowsMargins[rowIndex] = $$.isLegendInset ? 0 : rowMargin;
            itemsOffsets[id] = totalRowLength;
            totalRowLength += itemLength;

            if(totalRowLength > $$.legendLength){
                $$.legendLength = totalRowLength;
            }

            if (minMargin === null || rowsMargins[rowIndex] < minMargin){
                minMargin = rowsMargins[rowIndex];
            }
        }

        if (reset) {
            rowIndex = 0;
            maxWidth = 0;
            maxHeight = 0;
            totalRowLength = 0;
            $$.legendLength = 0;
            $$.legendStep = 0;
            minMargin = null;
        }

        if (config.legend_show && !$$.isLegendToShow(id)) {
            itemsWidths[id] = itemsHeights[id] = rowsIndexes[id] = itemsOffsets[id] = 0;
            return;
        }

        itemsWidths[id] = itemWidth;
        itemsHeights[id] = itemHeight;

        if (!maxWidth || itemWidth > maxWidth) { 
            maxWidth = itemWidth;
            $$.legendItemMaxWidth = itemWidth;
        }

        if (!maxHeight || itemHeight > maxHeight) { 
            maxHeight = itemHeight;
            $$.legendItemMaxHeight = itemHeight;
        }

        maxLength = !$$.isLegendHorizontal || $$.isLegendInset ? maxHeight : maxWidth;

        if ($$.isLegendInset) {
            legendAreaLength = config.legend_inset_step ? config.legend_inset_step * maxHeight : $$.currentHeight - config.legend_inset_y;
        } else if ($$.isLegendHorizontal){
            legendAreaLength = $$.isLegendLeft || $$.isLegendRight ? $$.currentWidth * ($$.hasArcType() ? 0.5 : 0.66) : $$.currentWidth;
        } else {
            legendAreaLength = ($$.isLegendLeft || $$.isLegendRight ? $$.currentHeight : $$.currentHeight * ($$.hasArcType() ? 0.5 : 0.66)) - $$.legendTitleHeight;
        }

        if (config.legend_equally) {
            Object.keys(itemsWidths).forEach(function (id) { itemsWidths[id] = maxWidth; });
            Object.keys(itemsHeights).forEach(function (id) { itemsHeights[id] = maxHeight; });
            rowMargin = (legendAreaLength - maxLength * targetIds.length) / 2;
            if (rowMargin < minRowMargin) {
                totalLength = 0;
                rowIndex = 0;
                targetIds.forEach(function (id) { updateValues(id); });
            } else {
                updateValues(id, true);
            }
        } else {
            updateValues(id);
        }
    }

    if (!$$.isLegendHorizontal || $$.isLegendInset) {
        xForLegend = function (id) { return maxWidth * rowsIndexes[id]; };
        yForLegend = function (id) { return rowsMargins[rowsIndexes[id]] + itemsOffsets[id] + $$.legendTitleHeight - minMargin; };
    } else {
        xForLegend = function (id) { return rowsMargins[rowsIndexes[id]] + itemsOffsets[id] - minMargin; };
        yForLegend = function (id) { return maxHeight * rowsIndexes[id] + $$.legendTitleHeight; };        
    }

    x1ForLegendTile = function (id, i) { return xForLegend(id, i) + tilePaddingLeft; };
    x2ForLegendTile = function (id, i) { return x1ForLegendTile(id, i) + config.legend_item_tile_width; };
    yForLegendTile = function (id, i) { return itemPaddingTop + yForLegend(id, i) + config.legend_item_tile_height / 2; };

    xForLegendText = function (id, i) { return x2ForLegendTile(id, i) + tilePaddingRight; };
    yForLegendText = function (id, i) { return itemPaddingTop + yForLegend(id, i) + config.legend_item_tile_height; };

    xForLegendRect = function (id, i) { return xForLegend(id, i); };
    yForLegendRect = function (id, i) { return yForLegend(id, i); };

    // Define g for legend area
    l = $$.legend.selectAll('.' + CLASS.legendItem)
        .data(targetIds)
        .enter().append('g')
        .attr('class', function (id) { return $$.generateClass(CLASS.legendItem, id); })
        .style('visibility', function (id) { return $$.isLegendToShow(id) ? 'visible' : 'hidden'; })
        .style('cursor', 'pointer')
        .on('click', function (id) {
            if (config.legend_item_onclick) {
                config.legend_item_onclick.call($$, id);
            } else {
                if ($$.d3.event.altKey) {
                    $$.api.hide();
                    $$.api.show(id);
                } else {
                    $$.api.toggle(id);
                    $$.isTargetToShow(id) ? $$.api.focus(id) : $$.api.revert();
                }
            }
        })
        .on('mouseover', function (id) {
            if (config.legend_item_onmouseover) {
                config.legend_item_onmouseover.call($$, id);
            }
            else {
                $$.d3.select(this).classed(CLASS.legendItemFocused, true);
                if (!$$.transiting && $$.isTargetToShow(id)) {
                    $$.api.focus(id);
                }
            }
        })
        .on('mouseout', function (id) {
            if (config.legend_item_onmouseout) {
                config.legend_item_onmouseout.call($$, id);
            }
            else {
                $$.d3.select(this).classed(CLASS.legendItemFocused, false);
                $$.api.revert();
            }
        });
    l.append('text')
        .attr("class", CLASS.legendItemText)
        .text(function (id) { return isDefined(config.data_names[id]) ? config.data_names[id] : id; })
        .each(function (id, i) { updateItemPosition(this, id, i); })
        .style("pointer-events", "none");
    l.append('rect')
        .attr("class", CLASS.legendItemEvent)
        .style('fill-opacity', 0);
    l.append('line')
        .attr('class', CLASS.legendItemTile)
        .style('stroke', $$.color)
        .style("pointer-events", "none")
        .attr('stroke-width', config.legend_item_tile_height);

    // Set background for legend
    background = $$.legend.select('.' + CLASS.legendBackground + ' rect');
    if (($$.isLegendInset || config.legend_showBackgroundRect) && maxWidth > 0 && background.size() === 0) {
        background = $$.legend.insert('g', '.' + CLASS.legendItem)
            .attr("class", CLASS.legendBackground)
            .append('rect');
    }

    legendTitle = $$.legend.select('.' + CLASS.legendTitle);
    if(!$$.isLegendInset && config.legend_title && legendTitle.size() === 0 && maxWidth > 0) {
        legendTitle = $$.legend.insert("text", '.' + CLASS.legendItem)
            .attr("class", CLASS.legendTitle);

        legendTitle.append("tspan")
            .text(config.legend_title);

        legendTitleTextBox = legendTitle.node().getBoundingClientRect();
        $$.legendTitleHeight = legendTitleTextBox.height + titlePadding;
        $$.legendTitleWidth = legendTitleTextBox.width + titlePadding * 2;
    }

    texts = $$.legend.selectAll('text.' + CLASS.legendItemText)
        .data(targetIds)
        .text(function (id) { return isDefined(config.data_names[id]) ? config.data_names[id] : id; }) // MEMO: needed for update
        .each(function (id, i) { updateItemPosition(this, id, i); });

    (withTransition ? texts.transition() : texts)
        .attr('x', xForLegendText)
        .attr('y', yForLegendText);

    rects = $$.legend.selectAll('rect.' + CLASS.legendItemEvent)
        .data(targetIds);

    (withTransition ? rects.transition() : rects)
        .attr('width', function (id) { return itemsWidths[id]; })
        .attr('height', function (id) { return itemsHeights[id]; })
        .attr('x', xForLegendRect)
        .attr('y', yForLegendRect);

    tiles = $$.legend.selectAll('line.' + CLASS.legendItemTile)
            .data(targetIds);

    (withTransition ? tiles.transition() : tiles)
        .style('stroke', $$.levelColor ? function (id) {
            return $$.levelColor($$.cache[id].values[0].value);
        } : $$.color)
        .attr('x1', x1ForLegendTile)
        .attr('y1', yForLegendTile)
        .attr('x2', x2ForLegendTile)
        .attr('y2', yForLegendTile);

    if (!$$.isLegendInset && config.legend_title && maxWidth > 0) {
        legendTitle.attr('x', titlePadding + ($$.getLegendWidth() - $$.legendTitleWidth) / 2).attr('y', $$.legendTitleHeight - titlePadding);
    }

    if(($$.isLegendInset || config.legend_showBackgroundRect) && maxWidth > 0 && background){
        (withTransition ? background.transition() : background)
            .attr('x', 0)
            .attr('y', 0)
            .attr('height', $$.getLegendHeight())
            .attr('width', $$.getLegendWidth());
    }

    // toggle legend state
    $$.legend.selectAll('.' + CLASS.legendItem)
        .classed(CLASS.legendItemHidden, function (id) { return !$$.isTargetToShow(id); });

    // Update size and scale
    $$.updateSizes();
    $$.updateScales();
    $$.updateSizes();
    $$.updateScales();
    $$.updateSvgSize();
    // Update g positions
    $$.transformAll(withTransitionForTransform, transitions);
    $$.legendHasRendered = true;
};
