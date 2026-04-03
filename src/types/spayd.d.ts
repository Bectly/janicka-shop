declare module "spayd" {
  interface SpaydParams {
    acc: string;
    am?: string;
    cc?: string;
    xvs?: string;
    xss?: string;
    xks?: string;
    msg?: string;
    dt?: string;
    rn?: string;
    [key: string]: string | undefined;
  }

  function spayd(params: SpaydParams): string;
  export default spayd;
}
