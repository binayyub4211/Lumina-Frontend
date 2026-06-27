import * as d3 from 'd3';

export const configureTreeLayout = (width: number, height: number) => {
  // Swapping width and height coordinates creates a clean left-to-right horizontal tree
  return d3.tree()
    .size([height - 80, width - 240]) 
    .nodeSize([40, 180]); // Enforces consistent spacing between nodes
};