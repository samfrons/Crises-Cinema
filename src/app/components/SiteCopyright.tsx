// One notice, one place: every page's footer ends with the same line, so the
// site's ownership does not drift page to page as pages are added.
export default function SiteCopyright() {
  return (
    <p className="site-copy">
      © 2026{' '}
      <a href="https://samfrons.xyz" rel="noopener">
        samfrons.xyz
      </a>
    </p>
  );
}
