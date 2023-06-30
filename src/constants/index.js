import { ELEMENT_TYPE } from './element.js'
import { TOOL_TYPE } from './tools.js'

export { TOOL_TYPE, TOOLS } from './tools.js'
export { ELEMENT_TYPE } from './element.js'

export const TOOL_ELEMENT_MAP = {
  [TOOL_TYPE.LINE]: ELEMENT_TYPE.LINE,
  [TOOL_TYPE.RECTANGLE]: ELEMENT_TYPE.RECTANGLE,
  [TOOL_TYPE.ELLIPSE]: ELEMENT_TYPE.ELLIPSE,
  [TOOL_TYPE.DIAMOND]: ELEMENT_TYPE.DIAMOND,
  [TOOL_TYPE.TEXT]: ELEMENT_TYPE.TEXT,
  [TOOL_TYPE.IMAGE]: ELEMENT_TYPE.IMAGE,
}

export {
  MIN_ZOOM,
  MAX_ZOOM,
  ADJUST_ZOOM_MODE,
} from './zoom.js'

export { ORIENTATION } from './geometry.js'
