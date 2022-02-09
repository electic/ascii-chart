import {
  getPlotCoords,
  toArrays,
  getMax,
  getMin,
  toArray,
  toPlot,
  toSorted,
  distance,
  toEmpty,
  toCoordinates,
} from './coords';
import { getAnsiColor } from './settings';
import {
  SingleLine, MultiLine, Plot, Color,
} from '../types';
import { AXIS, CHART, EMPTY } from '../constants';

export const plot: Plot = (rawInput, {
  color, width, height, axisCenter,
} = {}) => {
  let input = rawInput as MultiLine;
  if (typeof input[0][0] === 'number') {
    input = [rawInput] as MultiLine;
  }

  let scaledCoords = [[0, 0]];

  const [rangeX, rangeY] = toArrays(input);

  const minX = getMin(rangeX);
  const maxX = getMax(rangeX);
  const minY = getMin(rangeY);
  const maxY = getMax(rangeY);

  // set default size
  const plotWidth = width || rangeX.length;

  let plotHeight = Math.round(height || maxY - minY + 1);

  // for small values without height
  if (!height && plotHeight < 3) {
    plotHeight = rangeY.length;
  }

  // create placeholder
  const graph = Array.from({ length: plotHeight + 2 }, () => toEmpty(plotWidth + 2));

  const chart = { ...CHART };
  input.forEach((coords: SingleLine, series) => {
    if (color) {
      let currentColor = '';
      if (Array.isArray(color)) {
        currentColor = color[series];
      } else {
        currentColor = color;
      }

      Object.entries(CHART).forEach(([key, sign]) => {
        chart[key as keyof typeof chart] = `${getAnsiColor(currentColor as Color)}${sign}\u001b[0m`;
      });
    }

    // sort input by the first value
    const sortedCoords = toSorted(coords);

    scaledCoords = getPlotCoords(
      sortedCoords,
      plotWidth,
      plotHeight,
      [minX, maxX],
      [minY, maxY],
    ).map(([x, y], index, arr) => {
      const [scaledX, scaledY] = toPlot(plotWidth, plotHeight)(x, y);

      // add axis stamps
      if (axisCenter) {
        const [centerX, centerY] = toCoordinates(
          axisCenter,
          plotWidth,
          plotHeight,
          [minX, maxX],
          [minY, maxY],
        );
        const [plotCenterX, plotCenterY] = toPlot(plotWidth, plotHeight)(centerX, centerY);
        graph[plotCenterY + 1][scaledX] = AXIS.x;
        graph[scaledY + 1][plotCenterX + 1] = AXIS.y;
      } else {
        graph[graph.length - 1][scaledX + 1] = AXIS.x;
        graph[scaledY + 1][0] = AXIS.y;
      }

      if (index - 1 >= 0) {
        const [prevX, prevY] = arr[index - 1];
        const [currX, currY] = arr[index];

        Array(distance(currY, prevY))
          .fill('')
          .forEach((_, steps, array) => {
            if (Math.round(prevY) > Math.round(currY)) {
              graph[scaledY + 1][scaledX] = chart.nse;
              if (steps === array.length - 1) {
                graph[scaledY - steps][scaledX] = chart.wns;
              } else {
                graph[scaledY - steps][scaledX] = chart.ns;
              }
            } else {
              graph[scaledY + steps + 2][scaledX] = chart.wsn;
              graph[scaledY + steps + 1][scaledX] = chart.ns;
            }
          });

        if (Math.round(prevY) < Math.round(currY)) {
          graph[scaledY + 1][scaledX] = chart.sne;
        } else if (Math.round(prevY) === Math.round(currY)) {
          graph[scaledY + 1][scaledX] = chart.we;
        }

        const distanceX = distance(currX, prevX);
        Array(distanceX ? distanceX - 1 : 0)
          .fill('')
          .forEach((_, steps) => {
            const thisY = plotHeight - Math.round(prevY);
            graph[thisY][Math.round(prevX) + steps + 1] = chart.we;
          });
      }

      // plot the last coordinate
      if (arr.length - 1 === index) {
        graph[scaledY + 1][scaledX + 1] = chart.we;
      }
      return [scaledX, scaledY];
    });
  });

  // axis
  graph.forEach((line, index) => {
    line.forEach((char, curr) => {
      let lineChar = '';
      if (!axisCenter) {
        if (curr === 0) {
          if (index === 0) {
            lineChar = AXIS.n;
          } else if (char === AXIS.y) {
            return;
          } else if (index === graph.length - 1) {
            lineChar = AXIS.nse;
          } else {
            lineChar = AXIS.ns;
          }
        } else if (index === graph.length - 1) {
          if (curr === line.length - 1) {
            lineChar = AXIS.e;
          } else if (char === AXIS.x) {
            return;
          } else {
            lineChar = AXIS.we;
          }
        }
      } else {
        const [centerX, centerY] = toCoordinates(
          axisCenter,
          plotWidth,
          plotHeight,
          [minX, maxX],
          [minY, maxY],
        );
        const [plotCenterX, plotCenterY] = toPlot(plotWidth, plotHeight)(centerX, centerY);

        if (curr === plotCenterX + 1) {
          if (index === 0) {
            lineChar = AXIS.n;
          } else if (char === AXIS.y) {
            return;
          } else {
            lineChar = AXIS.ns;
          }
        } else if (index === plotCenterY + 1) {
          if (curr === line.length - 1) {
            lineChar = AXIS.e;
          } else if (char === AXIS.x) {
            return;
          } else {
            lineChar = AXIS.we;
          }
        }
      }

      if (lineChar) {
        // eslint-disable-next-line
        line[curr] = lineChar;
      }
    });
  });

  const xShift = toArray(maxX).length;
  const yShift = toArray(maxY).length;
  // shift graph
  graph.unshift(toEmpty(plotWidth + 2)); // top
  graph.push(toEmpty(plotWidth + 2)); // bottom

  // check step
  let step = plotWidth;
  scaledCoords.forEach(([x], index) => {
    if (scaledCoords[index - 1]) {
      const current = x - scaledCoords[index - 1][0];
      step = current <= step ? current : step;
    }
  });

  // x coords overlap
  const hasToBeMoved = step < xShift;
  if (hasToBeMoved) graph.push(toEmpty(plotWidth + 1));
  graph.forEach((line) => {
    for (let i = 0; i <= yShift; i += 1) {
      line.unshift(EMPTY); // left
    }
  });

  // shift coords
  input.forEach((current) => {
    const coord = getPlotCoords(current, plotWidth, plotHeight, [minX, maxX], [minY, maxY]);
    current.forEach(([pointX, pointY], index) => {
      const [x, y] = coord[index];

      const [scaledX, scaledY] = toPlot(plotWidth, plotHeight)(x, y);

      const pointYShift = toArray(pointY);

      for (let i = 0; i < pointYShift.length; i += 1) {
        if (axisCenter) {
          const [centerX, centerY] = toCoordinates(
            axisCenter,
            plotWidth,
            plotHeight,
            [minX, maxX],
            [minY, maxY],
          );
          const [plotCenterX] = toPlot(plotWidth, plotHeight)(centerX, centerY);
          const char = pointYShift[pointYShift.length - 1 - i];
          graph[scaledY + 2][plotCenterX + 1 + yShift - i] = char;
        } else {
          graph[scaledY + 2][yShift - i] = pointYShift[pointYShift.length - 1 - i];
        }
      }

      const pointXShift = toArray(pointX);
      for (let i = 0; i < pointXShift.length; i += 1) {
        if (axisCenter) {
          const [centerX, centerY] = toCoordinates(
            axisCenter,
            plotWidth,
            plotHeight,
            [minX, maxX],
            [minY, maxY],
          );
          const [plotCenterX, plotCenterY] = toPlot(plotWidth, plotHeight)(centerX, centerY);
          const yPos = index % 2 && hasToBeMoved ? plotCenterY + 4 : plotCenterY + 3;

          graph[yPos][scaledX + yShift - i + 1] = pointXShift[pointXShift.length - 1 - i];
        } else {
          const yPos = index % 2 && hasToBeMoved ? graph.length - 2 : graph.length - 1;

          graph[yPos][scaledX + yShift - i + 2] = pointXShift[pointXShift.length - 1 - i];
        }
      }
    });
  });

  return `\n${graph.map((line) => line.join('')).join('\n')}\n`;
};
