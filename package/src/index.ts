export { Book } from './Book/Book';
export type {
  BookBaseProps,
  BookCssVariables,
  BookFactory,
  BookPageData,
  BookProps,
  BookStylesNames,
} from './Book/Book';
export type { BookContextValue, BookInheritableProps } from './Book/Book.context';
export { faceToTurnedPages, turnedPagesToFace } from './Book/page-index';
export { BookPage } from './Book/BookPage';
export type { BookPageProps } from './Book/BookPage';

// Face marker props (Book.Page.Front / Book.Page.Back).
export type { CurlFaceAlign, CurlFaceProps } from './CurlFace/CurlFace';

// Styles API factory of a single page (Book.Page forwards to the internal
// Curl engine, whose selectors are the page's DOM).
export type { CurlFactory, CurlStylesNames } from './Curl/Curl';

// Pure flip math — exported for advanced consumers.
export type { Point, ReflectionFold } from './flip/geometry';
