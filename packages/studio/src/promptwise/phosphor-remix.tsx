// promptwise: Studio imports @phosphor-icons/react everywhere; the build aliases that package to this
// file, so every icon is a Remix icon without touching upstream files. Names follow Phosphor's.
import {
  createContext,
  forwardRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
  type SVGProps,
} from "react";
import * as Ri from "@remixicon/react";

export type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
export type IconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & {
  size?: number | string;
  color?: string;
  weight?: IconWeight;
  mirrored?: boolean;
  alt?: string;
};
export type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

type Remix = typeof Ri.RiAddLine;

/** Phosphor's weight and mirroring props have no Remix twin; `fill` picks the filled icon when there is one. */
function icon(line: Remix, fill = line): Icon {
  return forwardRef<SVGSVGElement, IconProps>(function RemixIcon(
    {
      weight,
      mirrored,
      alt,
      size = "1em",
      style,
      width: _width,
      height: _height,
      fill: _fill,
      viewBox: _viewBox,
      children: _children,
      ...rest
    },
    _ref,
  ) {
    const Shape = weight === "fill" ? fill : line;
    const flip = mirrored ? { transform: "scaleX(-1)", ...style } : style;
    return (
      <Shape
        size={size}
        aria-label={alt}
        aria-hidden={alt ? undefined : true}
        style={flip}
        {...rest}
      />
    );
  });
}

/** Phosphor's context for default props; Remix has none, so it only carries them through. */
export const IconContext = createContext<IconProps>({});

export const Aperture = icon(Ri.RiCameraLensLine, Ri.RiCameraLensFill);
export const ArrowClockwise = icon(Ri.RiArrowGoForwardLine);
export const ArrowCounterClockwise = icon(Ri.RiArrowGoBackLine);
export const ArrowLeft = icon(Ri.RiArrowLeftLine);
export const ArrowLineLeft = icon(Ri.RiContractLeftLine);
export const ArrowLineRight = icon(Ri.RiContractRightLine);
export const ArrowSquareOut = icon(Ri.RiExternalLinkLine);
export const ArrowsOutCardinal = icon(Ri.RiDragMove2Line);
export const ArrowsOutLineHorizontal = icon(Ri.RiExpandLeftRightLine);
export const BezierCurve = icon(Ri.RiPenNibLine, Ri.RiPenNibFill);
export const BracketsCurly = icon(Ri.RiBracesLine);
export const Camera = icon(Ri.RiCameraLine, Ri.RiCameraFill);
export const CaretDown = icon(Ri.RiArrowDownSLine);
export const CaretRight = icon(Ri.RiArrowRightSLine);
export const ChartBarHorizontal = icon(Ri.RiBarChartHorizontalLine, Ri.RiBarChartHorizontalFill);
export const Check = icon(Ri.RiCheckLine);
export const CheckCircle = icon(Ri.RiCheckboxCircleLine, Ri.RiCheckboxCircleFill);
export const ClipboardText = icon(Ri.RiClipboardLine, Ri.RiClipboardFill);
export const Clock = icon(Ri.RiTimeLine, Ri.RiTimeFill);
export const Code = icon(Ri.RiCodeLine);
export const Copy = icon(Ri.RiFileCopyLine, Ri.RiFileCopyFill);
export const CornersIn = icon(Ri.RiFullscreenExitLine);
export const CornersOut = icon(Ri.RiFullscreenLine);
export const DotsThree = icon(Ri.RiMoreFill);
export const Eye = icon(Ri.RiEyeLine, Ri.RiEyeFill);
export const EyeSlash = icon(Ri.RiEyeOffLine, Ri.RiEyeOffFill);
export const Eyedropper = icon(Ri.RiSipLine, Ri.RiSipFill);
export const File = icon(Ri.RiFileLine, Ri.RiFileFill);
export const FileCode = icon(Ri.RiFileCodeLine, Ri.RiFileCodeFill);
export const FileCss = icon(Ri.RiCss3Line, Ri.RiCss3Fill);
export const FileHtml = icon(Ri.RiHtml5Line, Ri.RiHtml5Fill);
export const FileJpg = icon(Ri.RiFileImageLine, Ri.RiFileImageFill);
export const FileJs = icon(Ri.RiJavascriptLine, Ri.RiJavascriptFill);
export const FileJsx = icon(Ri.RiReactjsLine, Ri.RiReactjsFill);
export const FileMd = icon(Ri.RiMarkdownLine, Ri.RiMarkdownFill);
export const FilePlus = icon(Ri.RiFileAddLine, Ri.RiFileAddFill);
export const FilePng = FileJpg;
export const FileSvg = FileJpg;
export const FileTs = FileCode;
export const FileTsx = FileJsx;
export const FileTxt = icon(Ri.RiFileTextLine, Ri.RiFileTextFill);
export const FileVideo = icon(Ri.RiFileVideoLine, Ri.RiFileVideoFill);
export const FilmSlate = icon(Ri.RiMovieLine, Ri.RiMovieFill);
export const FilmStrip = icon(Ri.RiFilmLine, Ri.RiFilmFill);
export const FolderSimple = icon(Ri.RiFolderLine, Ri.RiFolderFill);
export const FolderSimplePlus = icon(Ri.RiFolderAddLine, Ri.RiFolderAddFill);
export const FrameCorners = icon(Ri.RiFullscreenLine);
export const Gear = icon(Ri.RiSettings3Line, Ri.RiSettings3Fill);
export const GridFour = icon(Ri.RiGridLine, Ri.RiGridFill);
export const Image = icon(Ri.RiImageLine, Ri.RiImageFill);
export const Layout = icon(Ri.RiLayoutLine, Ri.RiLayoutFill);
export const Lightning = icon(Ri.RiFlashlightLine, Ri.RiFlashlightFill);
export const Link = icon(Ri.RiLinksLine);
export const LinkSimple = Link;
export const Magnet = icon(Ri.RiCrosshair2Line, Ri.RiCrosshair2Fill);
export const MagnetStraight = Magnet;
export const MagnifyingGlassMinus = icon(Ri.RiZoomOutLine);
export const MagnifyingGlassPlus = icon(Ri.RiZoomInLine);
export const Minus = icon(Ri.RiSubtractLine);
export const Monitor = icon(Ri.RiComputerLine, Ri.RiComputerFill);
export const MusicNote = icon(Ri.RiMusic2Line, Ri.RiMusic2Fill);
export const Palette = icon(Ri.RiPaletteLine, Ri.RiPaletteFill);
export const Path = icon(Ri.RiRouteLine, Ri.RiRouteFill);
export const PencilSimple = icon(Ri.RiPencilLine, Ri.RiPencilFill);
export const Plus = icon(Ri.RiAddLine);
export const Presentation = icon(Ri.RiSlideshowLine, Ri.RiSlideshowFill);
export const Ruler = icon(Ri.RiRulerLine, Ri.RiRulerFill);
export const Scissors = icon(Ri.RiScissorsLine, Ri.RiScissorsFill);
export const SlidersHorizontal = icon(Ri.RiEqualizerLine, Ri.RiEqualizerFill);
export const SpeakerHigh = icon(Ri.RiVolumeUpLine, Ri.RiVolumeUpFill);
export const SpeakerSlash = icon(Ri.RiVolumeMuteLine, Ri.RiVolumeMuteFill);
export const Square = icon(Ri.RiSquareLine, Ri.RiSquareFill);
export const SquareSplitVertical = icon(Ri.RiSplitCellsVertical);
export const SquaresFour = icon(Ri.RiLayoutGridLine, Ri.RiLayoutGridFill);
export const Stack = icon(Ri.RiStackLine, Ri.RiStackFill);
export const TextAa = icon(Ri.RiFontSize);
export const TextT = icon(Ri.RiText);
export const Trash = icon(Ri.RiDeleteBinLine, Ri.RiDeleteBinFill);
export const Warning = icon(Ri.RiAlertLine, Ri.RiAlertFill);
export const Waveform = icon(Ri.RiVoiceprintLine, Ri.RiVoiceprintFill);
export const X = icon(Ri.RiCloseLine);

// Phosphor's `*Icon` spellings.
export {
  CaretRight as CaretRightIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  X as XIcon,
};
