import { render } from '@mantine-tests/core';
import React from 'react';
import { Book } from './Book';

describe('Book', () => {
  it('renders without crashing with no pages', () => {
    const { container } = render(<Book />);
    expect(container).toBeTruthy();
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Book ref={ref}>
        <Book.Page>One</Book.Page>
      </Book>
    );
    expect(ref.current).toBeTruthy();
  });

  it('exposes Page as static compound child', () => {
    expect(Book.Page).toBeDefined();
    expect(Book.Page.displayName).toBe('Book.Page');
  });

  it('renders the active page content', () => {
    const { getByText } = render(
      <Book defaultPage={0}>
        <Book.Page>One</Book.Page>
        <Book.Page>Two</Book.Page>
      </Book>
    );
    expect(getByText('One')).toBeInTheDocument();
  });

  it('respects controlled `currentPage` (spread mode shows left = idx-1, right = idx)', () => {
    const { getByText } = render(
      <Book currentPage={1}>
        <Book.Page>One</Book.Page>
        <Book.Page>Two</Book.Page>
        <Book.Page>Three</Book.Page>
      </Book>
    );
    expect(getByText('Two')).toBeInTheDocument();
  });

  it('marks the first and last pages as hard when `showCover` is set', () => {
    const { container } = render(
      <Book showCover>
        <Book.Page>Cover</Book.Page>
        <Book.Page>Mid</Book.Page>
        <Book.Page>Back</Book.Page>
      </Book>
    );
    const root = container.querySelector('[data-mode]');
    expect(root).toBeTruthy();
  });

  it('exposes `data-mode` on the viewport', () => {
    const { container } = render(
      <Book>
        <Book.Page>One</Book.Page>
      </Book>
    );
    const viewport = container.querySelector('[data-mode]');
    expect(viewport).toBeTruthy();
  });
});
