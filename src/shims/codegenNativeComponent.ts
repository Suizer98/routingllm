type NativeComponentOptions = {
  interfaceOnly?: boolean;
  paperComponentName?: string;
  excludedPlatforms?: string[];
};

export default function codegenNativeComponent<Props extends object>(
  componentName: string,
  options?: NativeComponentOptions,
): (props: Props) => null {
  void componentName;
  void options;

  return () => null;
}
