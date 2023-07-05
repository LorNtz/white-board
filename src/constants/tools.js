import {
  MoveOne,
  Palm,
  Square,
  DiamondThree as Diamond,
  Round,
  Minus as Line,
  FontSize as Text,
  // Write as Pen,
  Pencil as Pen,
  Picture,
} from '@icon-park/react'

export const TOOL_TYPE = {
  SELECTION: 'selection',
  PAN: 'pan',
  RECTANGLE: 'rectangle',
  LINE: 'line',
  DIAMOND: 'diamond',
  ELLIPSE: 'ellipse',
  FREEDRAW: 'freedraw',
  TEXT: 'text',
  IMAGE: 'image',
}

export const TOOLS = [
  {
    icon: <MoveOne />,
    value: TOOL_TYPE.SELECTION,
  },
  {
    icon: <Palm />,
    value: TOOL_TYPE.PAN,
  },
  {
    icon: <Square />,
    value: TOOL_TYPE.RECTANGLE,
  },
  {
    icon: <Line />,
    value: TOOL_TYPE.LINE,
  },
  {
    icon: <Diamond />,
    value: TOOL_TYPE.DIAMOND,
  },
  {
    icon: <Round />,
    value: TOOL_TYPE.ELLIPSE,
  },
  {
    icon: <Pen />,
    value: TOOL_TYPE.FREEDRAW,
  },
  {
    icon: <Text />,
    value: TOOL_TYPE.TEXT,
  },
  {
    icon: <Picture />,
    value: TOOL_TYPE.IMAGE,
  },
]
