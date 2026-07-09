type TransformMatrix = number[];

export function parse(_transform: string): TransformMatrix[] {
  return [];
}

export function stringify(_parsed: TransformMatrix[]): string {
  return "";
}

const transform = {
  parse,
  stringify,
};

export default transform;
