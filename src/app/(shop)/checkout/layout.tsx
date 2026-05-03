import ReactDOM from "react-dom";

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  ReactDOM.preconnect("https://payments.comgate.cz");
  ReactDOM.preconnect("https://widget.packeta.com");
  return <>{children}</>;
}
