/** gl-transitions (MIT): the community collection of GLSL image transitions, shipped as JSON. */
declare module "gl-transitions" {
  const transitions: {
    name: string;
    glsl: string;
    author: string;
    license: string;
    defaultParams: Record<string, number | number[]>;
    paramsTypes: Record<string, string>;
  }[];
  export default transitions;
}
