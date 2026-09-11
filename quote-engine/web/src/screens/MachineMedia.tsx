import { mediaFor } from '../api/media';

/**
 * The photograph and the links for a machine.
 *
 * Lifted out of QuoteBuilder when the machine list and the configuration became one
 * step: two files needed them, and a component copied into a second place is a
 * component that will differ from itself within a month.
 */

export function MachineThumb({ model }: { model?: string | null }) {
  const media = mediaFor(model);
  // thumb is null on a page whose models all carry a real photograph.
  if (!media?.thumb) return null;
  return (
    <img
      src={media.thumb}
      // Deliberately empty. The model and the description sit beside it in text, so
      // a screen reader announcing "photograph of an 6400" would repeat what it has
      // just read. An audit that counts missing alt attributes flags this; it is the
      // right answer for an image that carries nothing the text does not.
      alt=""
      width={72}
      height={72}
      loading="lazy"
      className="part-well mt-0.5 h-[72px] w-[72px] shrink-0 object-contain p-1"
    />
  );
}

/**
 * Where to read more about the machine.
 *
 * The product page rather than a path into this repository, because the same
 * build has to work from a preview file, from an artifact and from the deployed
 * app. Opens in a new tab: a rep three sections into a quote should not lose it
 * to a datasheet.
 */
export function MachineLinks({ model }: { model?: string | null }) {
  const media = mediaFor(model);
  if (!media) return null;
  // The model code, not the page title. Within one price book most rows share a
  // machine, so eight repetitions of "Corvus 6400 Continuous Inkjet Printer" was
  // just a wall — while the code still says which machine, in four characters.
  // The full name is the link's tooltip for anyone who wants it.
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs">
      <a href={media.page} target="_blank" rel="noreferrer" title={media.name}
         className="num font-semibold text-instr-700 underline decoration-instr-300 hover:text-instr-800">
        {model}
      </a>
      {/* The datasheet link lives with the specification now, not here.
          Two components answered "where is the spec" from two different sources and
          neither knew about the other, so the answer moved around the card depending
          on which machine you were looking at. See MachineSpecs. */}
    </p>
  );
}

/**
 * The machine, at a size worth looking at.
 *
 * The app carried 96px thumbs and nothing larger, so the one screen where a rep has
 * committed to a coder showed it at the size of a favicon while 386 real photographs
 * sat in the library. A configurator for industrial equipment that will not show you
 * the equipment is doing half its job.
 *
 * Only where a real photograph exists. A captured web page enlarged to 340px is a
 * screenshot of a screenshot, and the thumbnail is the honest size for one.
 */
export function MachineHero({ model }: { model?: string | null }) {
  const media = mediaFor(model);
  const src = media?.hero ?? media?.thumb ?? null;

  /* Always a well, photograph or not.
     Nine of the models carry a real photograph and the rest do not, so a hero that
     renders nothing leaves a different layout on most quotes than on a few — and a
     blank where the product should be reads as a broken image rather than as a fact
     about the library. The absence is stated instead, which is the same answer this
     tool gives everywhere else it does not know something. */
  return (
    <span className="part-well flex h-[168px] w-[200px] shrink-0 items-center justify-center p-2">
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          /* Fills the well, photograph or capture.
             The capture used to be pinned to 72px in the middle of a 220x168 box,
             which is mostly empty box — it read as a broken image rather than as a
             small one. That clamp was written when the thumbnails were 96px and
             enlarging one meant blurring it; build_photos.py emits 176px now, so a
             168px well is a downscale either way and there is nothing to protect. */
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        // steel-600, not 500: on the well's steel-50 ground the lighter step
        // measures 4.43:1, under the body floor.
        <span className="px-3 text-center text-2xs leading-snug text-steel-600">
          No photograph of this model on file
        </span>
      )}
    </span>
  );
}
