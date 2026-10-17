/** The ABU E LFADL wordmark (text is drawn with the embedded AEF-* fonts). Used in the header and the footer. */
export function Wordmark() {
  return (
    <>
      <span className="mark-img" role="img" aria-label="شعار أبو الفضل" />
      <span className="wm2" role="img" aria-label="أبو الفضل ستور">
        <i className="s1">SINCE</i>
        <i className="s2">2014</i>
        <span className="w">
          <b>ABU</b>
          <em>E</em>
          <b>LFADL</b>
        </span>
        <i className="s3">DAIRY STORE</i>
      </span>
    </>
  );
}
