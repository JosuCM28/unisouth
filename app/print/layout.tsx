/**
 * Layout de las vistas de impresión.
 *
 * Existe sólo para devolverles el scroll del documento. El `<body>` fija su
 * alto a la ventana en escritorio —para que el tablero scrollee por dentro y
 * la barra lateral no se pierda—, pero estas páginas no tienen esa columna
 * interior: sin este contenedor, una hoja larga como la de una pila de 63
 * rollos quedaría recortada a la altura de la pantalla y sin forma de bajar.
 */
export default function PrintLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="h-dvh w-full overflow-y-auto print:h-auto print:overflow-visible">
      {children}
    </div>
  );
}
