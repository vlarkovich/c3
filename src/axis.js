import CLASS from './class';
import {
    isValue,
    isFunction,
    isString,
    isEmpty
} from './util';
import {
    AxisInternal
} from './axis-internal';

export default class Axis {
    constructor(owner) {
        this.owner = owner;
        this.d3 = owner.d3;
        this.internal = AxisInternal;
    }
}
Axis.prototype.init = function init() {
    var $$ = this.owner,
        config = $$.config,
        main = $$.main;
    $$.axes.x = main.append("g")
        .attr("class", CLASS.axis + ' ' + CLASS.axisX)
        .attr("clip-path", config.axis_x_inner ? "" : $$.clipPathForXAxis)
        .attr("transform", $$.getTranslate('x'))
        .style("visibility", config.axis_x_show ? 'visible' : 'hidden');
    $$.axes.x.append("text")
        .attr("class", CLASS.axisXLabel)
        .attr("transform", config.axis_rotated ? "rotate(-90)" : "")
        .style("text-anchor", this.textAnchorForXAxisLabel.bind(this));
    $$.axes.y = main.append("g")
        .attr("class", CLASS.axis + ' ' + CLASS.axisY)
        .attr("clip-path", config.axis_y_inner ? "" : $$.clipPathForYAxis)
        .attr("transform", $$.getTranslate('y'))
        .style("visibility", config.axis_y_show ? 'visible' : 'hidden');
    $$.axes.y.append("text")
        .attr("class", CLASS.axisYLabel)
        .attr("transform", config.axis_rotated ? "" : "rotate(-90)")
        .style("text-anchor", this.textAnchorForYAxisLabel.bind(this));

    $$.axes.y2 = main.append("g")
        .attr("class", CLASS.axis + ' ' + CLASS.axisY2)
        // clip-path?
        .attr("transform", $$.getTranslate('y2'))
        .style("visibility", config.axis_y2_show ? 'visible' : 'hidden');
    $$.axes.y2.append("text")
        .attr("class", CLASS.axisY2Label)
        .attr("transform", config.axis_rotated ? "" : "rotate(-90)")
        .style("text-anchor", this.textAnchorForY2AxisLabel.bind(this));
};
Axis.prototype.getXAxis = function getXAxis(scale, orient, tickFormat, tickValues, withOuterTick, withoutTransition, canRotate) {
    var $$ = this.owner,
        config = $$.config,
        axisParams = {
            isCategory: $$.isCategorized(),
            isTimeSeries: $$.isTimeSeries(),
            withOuterTick: withOuterTick,
            tickMultiline: config.axis_x_tick_multiline,
            tickMultilineMax: config.axis_x_tick_multiline ? Number(config.axis_x_tick_multilineMax) : 0,
            tickWidth: config.axis_x_tick_width,
            tickTextRotate: canRotate ? config.axis_x_tick_rotate : 0,
            withoutTransition: withoutTransition,
            tickMinorShow: config.axis_x_tick_minor_show,
            tickMajorShow: config.axis_x_tick_major_show,
            majorTickTextShow: config.axis_x_tick_major_text,
            majorTickFactor: config.axis_x_tick_major_factor || 1,
            minorTickFactor: config.axis_x_tick_minor_factor || 1,
            majorTickUnits: config.axis_x_tick_major_units || 0,
            minorTickUnits: config.axis_x_tick_minor_units || 0
        }, axis;

    if(config.axis_rotated === false && config.axis_x_tick_rotateAuto && canRotate) {
        $$.tickTextRotate = axisParams.tickTextRotate;
        
        let scaleCopy = scale.copy();
        let scaleCopy1 = scale.copy();
        let domain = scaleCopy1.domain();
        scaleCopy1.domain([domain[0], domain[1] - 1]);
        let range = scaleCopy.range();
        scaleCopy.range([range[0], range[1] - (scaleCopy1(domain[1]) - scaleCopy(domain[1])) * 1.5]);

        this.calculateRotation("x", axisParams, scaleCopy, orient, tickFormat);
        $$.tickTextRotate = axisParams.tickTextRotate;
    }

    axis = new this.internal(this, axisParams).axis.scale(scale).orient(orient);

    if ($$.isTimeSeries() && tickValues && typeof tickValues !== "function") {
        tickValues = tickValues.map(function (v) {
            return $$.parseDate(v);
        });
    }

    // Set tick
    axis.tickFormat(tickFormat).tickValues(tickValues);
    if ($$.isCategorized()) {
        axis.tickCentered(config.axis_x_tick_centered);
        if (isEmpty(config.axis_x_tick_culling)) {
            config.axis_x_tick_culling = false;
        }
    }

    return axis;
};
Axis.prototype.calculateRotation = function calculateRotation(id, axisParams, scale, orient, tickFormat) {
    var $$ = this.owner,
        self = this,
        config = $$.config,
        targetsToShow = $$.filterTargetsToShow($$.data.targets),
        tickValues = $$.xAxisTickValues,
        axis = new this.internal(this, axisParams).axis.scale(scale).orient(orient), 
        dummy, svg, prevX;

    if ($$.isTimeSeries() && tickValues && typeof tickValues !== "function") {
        tickValues = tickValues.map(function (v) {
            return $$.parseDate(v);
        });
    }

    // Set tick
    axis.tickFormat(tickFormat).tickValues(tickValues);
    if ($$.isCategorized()) {
        axis.tickCentered(config.axis_x_tick_centered);
        if (isEmpty(config.axis_x_tick_culling)) {
            config.axis_x_tick_culling = false;
        }
    }

    this.updateXAxisTickValues(targetsToShow, axis);

    dummy = $$.d3.select('body').append('div').classed('c3', true);
    svg = dummy.append("svg").style('visibility', 'hidden').style('position', 'fixed').style('top', 0).style('left', 0);
    svg.append('g').call(axis).each(function () {
        let incorrect = $$.d3.select(this).selectAll('text').nodes().some(function (node) {
            let box = node.getBoundingClientRect();
            if (prevX + 2 > box.x || (axis.tickValues() && axis.tickValues().length > 1 && box.x < 0)) {
                return true;
            }

            prevX = box.x + box.width;
            return false;
        });

        dummy.remove();
        if (incorrect) {
            axisParams.tickTextRotate -= 5;
            if (axisParams.tickTextRotate > -90) {
                self.calculateRotation(id, axisParams, scale, orient, tickFormat);
            }
        }
    });

    return;
};
Axis.prototype.updateXAxisTickValues = function updateXAxisTickValues(targets, axis) {
    var $$ = this.owner,
        config = $$.config,
        tickValues;
    if (config.axis_x_tick_fit || config.axis_x_tick_count) {
        tickValues = this.generateTickValues($$.mapTargetsToUniqueXs(targets), config.axis_x_tick_count, $$.isTimeSeries());
    }
    if (axis) {
        axis.tickValues(tickValues);
    } else {
        $$.xAxis.tickValues(tickValues);
        $$.subXAxis.tickValues(tickValues);
    }
    return tickValues;
};
Axis.prototype.getYAxis = function getYAxis(scale, orient, tickFormat, tickValues, withOuterTick, withoutTransition, canRotate, isY2) {
    var $$ = this.owner,
        config = $$.config,
        axisParams = {
            withOuterTick: withOuterTick,
            withoutTransition: withoutTransition,
            tickTextRotate: canRotate ? config.axis_y_tick_rotate : 0,
            tickMinorShow: isY2 ? config.axis_y2_tick_minor_show : config.axis_y_tick_minor_show,
            tickMajorShow: isY2 ? config.axis_y2_tick_major_show : config.axis_y_tick_major_show,
            majorTickTextShow: isY2 ? config.axis_y2_tick_major_text : config.axis_y_tick_major_text,
            majorTickFactor: (isY2 ? config.axis_y2_tick_major_factor : config.axis_y_tick_major_factor) || 1,
            minorTickFactor: (isY2 ? config.axis_y2_tick_minor_factor : config.axis_y_tick_minor_factor) || 1,
            majorTickUnits: (isY2 ? config.axis_y2_tick_major_units : config.axis_y_tick_major_units) || 0,
            minorTickUnits: (isY2 ? config.axis_y2_tick_minor_units : config.axis_y_tick_minor_units) || 0
        }, axis;

    if (config.axis_rotated && !isY2 && config.axis_y_tick_rotateAuto && canRotate) {
        $$.tickTextRotate = axisParams.tickTextRotate;
        this.calculateYRotation("y", axisParams, scale, orient, tickFormat);
        $$.tickTextRotate = axisParams.tickTextRotate;
    }

    axis = new this.internal(this, axisParams).axis.scale(scale).orient(orient).tickFormat(tickFormat);

    if ($$.isTimeSeriesY()) {
        axis.ticks(config.axis_y_tick_time_type, config.axis_y_tick_time_interval);
    } else {
        axis.tickValues(tickValues);
    }

    return axis;
};
Axis.prototype.calculateYRotation = function calculateRotation(id, axisParams, scale, orient, tickFormat) {
    var $$ = this.owner,
        self = this,
        config = $$.config,
        tickValues = $$.yAxisTickValues,
        axis = new self.internal(self, axisParams).axis.scale(scale).orient(orient).tickFormat(tickFormat), 
        dummy, svg, prevX;

    if ($$.isTimeSeriesY()) {
        axis.ticks(config.axis_y_tick_time_type, config.axis_y_tick_time_interval);
    } else {
        axis.tickValues(tickValues);
    }

    dummy = $$.d3.select('body').append('div').classed('c3', true);
    svg = dummy.append("svg").style('visibility', 'hidden').style('position', 'fixed').style('top', 0).style('left', 0);
    svg.append('g').call(axis).each(function () {
        let incorrect = $$.d3.select(this).selectAll('text').nodes().some(function (node) {
            let box = node.getBoundingClientRect();
            if (prevX + 2 > box.x || (axis.tickValues() && axis.tickValues().length > 1 && box.x < 0)) {
                return true;
            }

            prevX = box.x + box.width;
            return false;
        });

        dummy.remove();
        if (incorrect) {
            axisParams.tickTextRotate -= 5;
            if (axisParams.tickTextRotate > -90) {
                self.calculateYRotation(id, axisParams, scale, orient, tickFormat);
            }
        }
    });

    return;
};
Axis.prototype.getId = function getId(id) {
    var config = this.owner.config;
    return id in config.data_axes ? config.data_axes[id] : 'y';
};
Axis.prototype.getXAxisTickFormat = function getXAxisTickFormat() {
    // #2251 previously set any negative values to a whole number,
    // however both should be truncated according to the users format specification
    var $$ = this.owner,
        config = $$.config;
    let format = ($$.isTimeSeries()) ? $$.defaultAxisTimeFormat : ($$.isCategorized()) ? $$.categoryName : function (v) {
        return v;
    };

    if (config.axis_x_tick_format) {
        if (isFunction(config.axis_x_tick_format)) {
            format = config.axis_x_tick_format;
        } else if ($$.isTimeSeries()) {
            format = function (date) {
                return date ? $$.axisTimeFormat(config.axis_x_tick_format)(date) : "";
            };
        }
    }
    return isFunction(format) ? function (v) {
        return format.call($$, v);
    } : format;
};
Axis.prototype.getTickValues = function getTickValues(tickValues, axis) {
    return tickValues ? tickValues : axis ? axis.tickValues() : undefined;
};
Axis.prototype.getXAxisTickValues = function getXAxisTickValues() {
    return this.getTickValues(this.owner.config.axis_x_tick_values, this.owner.xAxis);
};
Axis.prototype.getYAxisTickValues = function getYAxisTickValues() {
    return this.getTickValues(this.owner.config.axis_y_tick_values, this.owner.yAxis);
};
Axis.prototype.getY2AxisTickValues = function getY2AxisTickValues() {
    return this.getTickValues(this.owner.config.axis_y2_tick_values, this.owner.y2Axis);
};
Axis.prototype.getLabelOptionByAxisId = function getLabelOptionByAxisId(axisId) {
    var $$ = this.owner,
        config = $$.config,
        option;
    if (axisId === 'y') {
        option = config.axis_y_label;
    } else if (axisId === 'y2') {
        option = config.axis_y2_label;
    } else if (axisId === 'x') {
        option = config.axis_x_label;
    }
    return option;
};
Axis.prototype.getLabelText = function getLabelText(axisId) {
    var option = this.getLabelOptionByAxisId(axisId);
    return isString(option) ? option : option ? option.text : null;
};
Axis.prototype.setLabelText = function setLabelText(axisId, text) {
    var $$ = this.owner,
        config = $$.config,
        option = this.getLabelOptionByAxisId(axisId);
    if (isString(option)) {
        if (axisId === 'y') {
            config.axis_y_label = text;
        } else if (axisId === 'y2') {
            config.axis_y2_label = text;
        } else if (axisId === 'x') {
            config.axis_x_label = text;
        }
    } else if (option) {
        option.text = text;
    }
};
Axis.prototype.getLabelPosition = function getLabelPosition(axisId, defaultPosition) {
    var option = this.getLabelOptionByAxisId(axisId),
        position = (option && typeof option === 'object' && option.position) ? option.position : defaultPosition;
    return {
        isInner: position.indexOf('inner') >= 0,
        isOuter: position.indexOf('outer') >= 0,
        isLeft: position.indexOf('left') >= 0,
        isCenter: position.indexOf('center') >= 0,
        isRight: position.indexOf('right') >= 0,
        isTop: position.indexOf('top') >= 0,
        isMiddle: position.indexOf('middle') >= 0,
        isBottom: position.indexOf('bottom') >= 0
    };
};
Axis.prototype.getXAxisLabelPosition = function getXAxisLabelPosition() {
    return this.getLabelPosition('x', this.owner.config.axis_rotated ? 'inner-top' : 'inner-right');
};
Axis.prototype.getYAxisLabelPosition = function getYAxisLabelPosition() {
    return this.getLabelPosition('y', this.owner.config.axis_rotated ? 'inner-right' : 'inner-top');
};
Axis.prototype.getY2AxisLabelPosition = function getY2AxisLabelPosition() {
    return this.getLabelPosition('y2', this.owner.config.axis_rotated ? 'inner-right' : 'inner-top');
};
Axis.prototype.getLabelPositionById = function getLabelPositionById(id) {
    return id === 'y2' ? this.getY2AxisLabelPosition() : id === 'y' ? this.getYAxisLabelPosition() : this.getXAxisLabelPosition();
};
Axis.prototype.textForXAxisLabel = function textForXAxisLabel() {
    return this.getLabelText('x');
};
Axis.prototype.textForYAxisLabel = function textForYAxisLabel() {
    return this.getLabelText('y');
};
Axis.prototype.textForY2AxisLabel = function textForY2AxisLabel() {
    return this.getLabelText('y2');
};
Axis.prototype.xForAxisLabel = function xForAxisLabel(forHorizontal, position) {
    var $$ = this.owner;
    if (forHorizontal) {
        return position.isLeft ? 0 : position.isCenter ? $$.width / 2 : $$.width;
    } else {
        return position.isBottom ? -$$.height : position.isMiddle ? -$$.height / 2 : 0;
    }
};
Axis.prototype.dxForAxisLabel = function dxForAxisLabel(forHorizontal, position) {
    if (forHorizontal) {
        return position.isLeft ? "0.5em" : position.isRight ? "-0.5em" : "0";
    } else {
        return position.isTop ? "-0.5em" : position.isBottom ? "0.5em" : "0";
    }
};
Axis.prototype.textAnchorForAxisLabel = function textAnchorForAxisLabel(forHorizontal, position) {
    if (forHorizontal) {
        return position.isLeft ? 'start' : position.isCenter ? 'middle' : 'end';
    } else {
        return position.isBottom ? 'start' : position.isMiddle ? 'middle' : 'end';
    }
};
Axis.prototype.xForXAxisLabel = function xForXAxisLabel() {
    return this.xForAxisLabel(!this.owner.config.axis_rotated, this.getXAxisLabelPosition());
};
Axis.prototype.xForYAxisLabel = function xForYAxisLabel() {
    return this.xForAxisLabel(this.owner.config.axis_rotated, this.getYAxisLabelPosition());
};
Axis.prototype.xForY2AxisLabel = function xForY2AxisLabel() {
    return this.xForAxisLabel(this.owner.config.axis_rotated, this.getY2AxisLabelPosition());
};
Axis.prototype.dxForXAxisLabel = function dxForXAxisLabel() {
    return this.dxForAxisLabel(!this.owner.config.axis_rotated, this.getXAxisLabelPosition());
};
Axis.prototype.dxForYAxisLabel = function dxForYAxisLabel() {
    return this.dxForAxisLabel(this.owner.config.axis_rotated, this.getYAxisLabelPosition());
};
Axis.prototype.dxForY2AxisLabel = function dxForY2AxisLabel() {
    return this.dxForAxisLabel(this.owner.config.axis_rotated, this.getY2AxisLabelPosition());
};
Axis.prototype.dyForXAxisLabel = function dyForXAxisLabel() {
    var $$ = this.owner,
        config = $$.config,
        position = this.getXAxisLabelPosition();
    if (config.axis_rotated) {
        return position.isInner ? "1.2em" : -25 - ($$.config.axis_x_inner ? 0 : this.getMaxTickWidth('x'));
    } else {
        return position.isInner ? "-0.5em" : config.axis_x_height ? config.axis_x_height - 10 : $$.getHorizontalAxisHeight("x") - 10;
    }
};
Axis.prototype.dyForYAxisLabel = function dyForYAxisLabel() {
    var $$ = this.owner,
        position = this.getYAxisLabelPosition();
    if ($$.config.axis_rotated) {
        return position.isInner ? "-0.5em" : $$.getHorizontalAxisHeight("y") - 10;
    } else {
        return position.isInner ? "1.2em" : -10 - ($$.config.axis_y_inner ? 0 : (this.getMaxTickWidth('y') + 10));
    }
};
Axis.prototype.dyForY2AxisLabel = function dyForY2AxisLabel() {
    var $$ = this.owner,
        position = this.getY2AxisLabelPosition();
    if ($$.config.axis_rotated) {
        return position.isInner ? "1.2em" : "-2.2em";
    } else {
        return position.isInner ? "-0.5em" : 15 + ($$.config.axis_y2_inner ? 0 : (this.getMaxTickWidth('y2') + 15));
    }
};
Axis.prototype.textAnchorForXAxisLabel = function textAnchorForXAxisLabel() {
    var $$ = this.owner;
    return this.textAnchorForAxisLabel(!$$.config.axis_rotated, this.getXAxisLabelPosition());
};
Axis.prototype.textAnchorForYAxisLabel = function textAnchorForYAxisLabel() {
    var $$ = this.owner;
    return this.textAnchorForAxisLabel($$.config.axis_rotated, this.getYAxisLabelPosition());
};
Axis.prototype.textAnchorForY2AxisLabel = function textAnchorForY2AxisLabel() {
    var $$ = this.owner;
    return this.textAnchorForAxisLabel($$.config.axis_rotated, this.getY2AxisLabelPosition());
};
Axis.prototype.getMaxTickWidth = function getMaxTickWidth(id, withoutRecompute) {
    var $$ = this.owner,
        config = $$.config,
        maxWidth = 0,
        targetsToShow, scale, axis, dummy, svg;
    if (withoutRecompute && $$.currentMaxTickWidths[id]) {
        return $$.currentMaxTickWidths[id];
    }
    if ($$.svg) {
        targetsToShow = $$.filterTargetsToShow($$.data.targets);
        if (id === 'y') {
            scale = $$.y.copy().domain($$.getYDomain(targetsToShow, 'y'));
            axis = this.getYAxis(scale, $$.yOrient, config.axis_y_tick_format, $$.yAxisTickValues, false, true, false, false);
        } else if (id === 'y2') {
            scale = $$.y2.copy().domain($$.getYDomain(targetsToShow, 'y2'));
            axis = this.getYAxis(scale, $$.y2Orient, config.axis_y2_tick_format, $$.y2AxisTickValues, false, true, false, true);
        } else {
            scale = $$.x.copy().domain($$.getXDomain(targetsToShow));
            axis = this.getXAxis(scale, $$.xOrient, $$.xAxisTickFormat, $$.xAxisTickValues, false, true);
            this.updateXAxisTickValues(targetsToShow, axis);
        }
        dummy = $$.d3.select('body').append('div').classed('c3', true);
        svg = dummy.append("svg").style('visibility', 'hidden').style('position', 'fixed').style('top', 0).style('left', 0),
            svg.append('g').call(axis).each(function () {
                $$.d3.select(this).selectAll('text').each(function () {
                    var box = this.getBoundingClientRect();
                    if (maxWidth < box.width) {
                        maxWidth = box.width;
                    }
                });
                dummy.remove();
            });
    }
    $$.currentMaxTickWidths[id] = maxWidth <= 0 ? $$.currentMaxTickWidths[id] : maxWidth;
    return $$.currentMaxTickWidths[id];
};

Axis.prototype.updateLabels = function updateLabels(withTransition) {
    var $$ = this.owner;
    var axisXLabel = $$.main.select('.' + CLASS.axisX + ' .' + CLASS.axisXLabel),
        axisYLabel = $$.main.select('.' + CLASS.axisY + ' .' + CLASS.axisYLabel),
        axisY2Label = $$.main.select('.' + CLASS.axisY2 + ' .' + CLASS.axisY2Label);
    (withTransition ? axisXLabel.transition() : axisXLabel)
    .attr("x", this.xForXAxisLabel.bind(this))
        .attr("dx", this.dxForXAxisLabel.bind(this))
        .attr("dy", this.dyForXAxisLabel.bind(this))
        .text(this.textForXAxisLabel.bind(this));
    (withTransition ? axisYLabel.transition() : axisYLabel)
    .attr("x", this.xForYAxisLabel.bind(this))
        .attr("dx", this.dxForYAxisLabel.bind(this))
        .attr("dy", this.dyForYAxisLabel.bind(this))
        .text(this.textForYAxisLabel.bind(this));
    (withTransition ? axisY2Label.transition() : axisY2Label)
    .attr("x", this.xForY2AxisLabel.bind(this))
        .attr("dx", this.dxForY2AxisLabel.bind(this))
        .attr("dy", this.dyForY2AxisLabel.bind(this))
        .text(this.textForY2AxisLabel.bind(this));
};
Axis.prototype.getPadding = function getPadding(padding, key, defaultValue, domainLength) {
    var p = typeof padding === 'number' ? padding : padding[key];
    if (!isValue(p)) {
        return defaultValue;
    }
    if (padding.unit === 'ratio') {
        return padding[key] * domainLength;
    }
    // assume padding is pixels if unit is not specified
    return this.convertPixelsToAxisPadding(p, domainLength);
};
Axis.prototype.convertPixelsToAxisPadding = function convertPixelsToAxisPadding(pixels, domainLength) {
    var $$ = this.owner,
        length = $$.config.axis_rotated ? $$.width : $$.height;
    return domainLength * (pixels / length);
};
Axis.prototype.generateTickValues = function generateTickValues(values, tickCount, forTimeSeries) {
    var tickValues = values,
        targetCount, start, end, count, interval, i, tickValue;
    if (tickCount) {
        targetCount = isFunction(tickCount) ? tickCount() : tickCount;
        // compute ticks according to tickCount
        if (targetCount === 1) {
            tickValues = [values[0]];
        } else if (targetCount === 2) {
            tickValues = [values[0], values[values.length - 1]];
        } else if (targetCount > 2) {
            count = targetCount - 2;
            start = values[0];
            end = values[values.length - 1];
            interval = (end - start) / (count + 1);
            // re-construct unique values
            tickValues = [start];
            for (i = 0; i < count; i++) {
                tickValue = +start + interval * (i + 1);
                tickValues.push(forTimeSeries ? new Date(tickValue) : tickValue);
            }
            tickValues.push(end);
        }
    }
    if (!forTimeSeries) {
        tickValues = tickValues.sort(function (a, b) {
            return a - b;
        });
    }
    return tickValues;
};
Axis.prototype.generateTransitions = function generateTransitions(duration) {
    var $$ = this.owner,
        axes = $$.axes;
    return {
        axisX: duration ? axes.x.transition().duration(duration) : axes.x,
        axisY: duration ? axes.y.transition().duration(duration) : axes.y,
        axisY2: duration ? axes.y2.transition().duration(duration) : axes.y2,
        axisSubX: duration ? axes.subx.transition().duration(duration) : axes.subx
    };
};
Axis.prototype.redraw = function redraw(duration, isHidden) {
    var $$ = this.owner,
        transition = duration ? $$.d3.transition().duration(duration) : null;
    $$.axes.x.style("opacity", isHidden ? 0 : 1).call($$.xAxis, transition);
    $$.axes.y.style("opacity", isHidden ? 0 : 1).call($$.yAxis, transition);
    $$.axes.y2.style("opacity", isHidden ? 0 : 1).call($$.y2Axis, transition);
    $$.axes.subx.style("opacity", isHidden ? 0 : 1).call($$.subXAxis, transition);
};
