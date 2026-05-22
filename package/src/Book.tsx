import {
  Box,
  BoxProps,
  createVarsResolver,
  getFontSize,
  getRadius,
  getSize,
  getThemeColor,
  PolymorphicFactory,
  polymorphicFactory,
  StylesApiProps,
  useProps,
  useStyles,
  type MantineColor,
  type MantineRadius,
  type MantineSize,
  type StyleProp,
} from '@mantine/core';
import React from 'react';
import classes from './Book.module.css';

export type LedVariant = 'flat' | '3d';

export type LedAnimationType = 'pulse' | 'flash' | 'breathe' | 'blink' | 'glow' | 'none';

export type BookStylesNames = 'root' | 'book' | 'label' | 'light' | 'glow';

export type BookCssVariables = {
  root:
    | '--book-size'
    | '--book-radius'
    | '--book-color'
    | '--book-intensity'
    | '--book-animation-duration'
    | '--book-glow-size'
    | '--book-justify-content';
};

export interface BookBaseProps {
  /** BOOK color from theme */
  color?: MantineColor;

  /** BOOK size */
  size?: MantineSize | (string & {}) | number;

  /** Border radius */
  radius?: MantineRadius | (string & {}) | number;

  /** Controls BOOK on/off state */
  value?: boolean;

  /** Light intensity (0-100) */
  intensity?: number;

  /** Enable animation */
  animate?: boolean;

  /** Animation type; one of 'pulse', 'flash', 'breathe', 'blink', 'glow', or 'none' */
  animationType?: LedAnimationType;

  /** Animation duration in seconds */
  animationDuration?: number;

  /** Label content */
  label?: React.ReactNode;

  /** Label position */
  labelPosition?: 'left' | 'right';

  /** `justify-content` CSS property */
  justify?: StyleProp<React.CSSProperties['justifyContent']>;
}

export interface BookProps extends BoxProps, BookBaseProps, StylesApiProps<BookFactory> {}

export type BookFactory = PolymorphicFactory<{
  props: BookProps;
  defaultComponent: 'div';
  defaultRef: HTMLDivElement;
  stylesNames: BookStylesNames;
  variant: LedVariant;
  vars: BookCssVariables;
}>;

const defaultProps: Partial<BookProps> = {
  color: 'green',
  size: 'sm',
  radius: 'xl',
  value: true,
  variant: 'flat',
  intensity: 80,
  animate: false,
  animationType: 'none',
  animationDuration: 1.5,
  labelPosition: 'right',
};

const varsResolver = createVarsResolver<BookFactory>(
  (theme, { size, radius, color, intensity, animationDuration, justify }) => {
    return {
      root: {
        '--book-size': getSize(size, 'book-size'),
        '--book-radius': radius === undefined ? undefined : getRadius(radius),
        '--book-color': getThemeColor(color, theme),
        '--book-intensity': intensity !== undefined ? `${intensity / 100}` : '0.8',
        '--book-animation-duration':
          animationDuration !== undefined ? `${animationDuration}s` : '1.5s',
        '--book-glow-size': `calc(var(--book-size) * 0.6)`,
        '--book-justify-content': String(justify) || 'center',
      },
    };
  }
);

export const Book = polymorphicFactory<BookFactory>((_props) => {
  const props = useProps('Book', defaultProps, _props);
  const {
    size,
    radius,
    color,
    intensity,
    animationDuration,
    value,
    animate,
    animationType,
    variant,
    label,
    labelPosition,
    justify,

    classNames,
    style,
    styles,
    unstyled,
    vars,
    className,
    mod,
    ...others
  } = props;

  const getStyles = useStyles<BookFactory>({
    name: 'Book',
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
  });

  return (
    <Box
      {...getStyles('root')}
      {...others}
      mod={[{ 'label-position': labelPosition }, mod]}
      __vars={{
        '--label-fz': getFontSize(size),
        '--label-lh': getSize(size, 'label-lh'),
      }}
    >
      <Box
        {...getStyles('book')}
        variant={variant}
        data-value={value || undefined}
        data-animate={animate && value ? animationType : undefined}
      >
        <Box {...getStyles('glow')} />
        <Box {...getStyles('light')} />
      </Box>
      {label && <Box {...getStyles('label')}>{label}</Box>}
    </Box>
  );
});

Book.classes = classes;
Book.displayName = 'Book';
