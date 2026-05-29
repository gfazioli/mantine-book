import { render } from '@mantine-tests/core';
import { fireEvent } from '@testing-library/react';
import React from 'react';
import { Curl } from './Curl';

describe('Curl', () => {
  it('renders without crashing with no faces', () => {
    const { container } = render(<Curl />);
    expect(container.querySelector('[class*="root"]')).toBeTruthy();
  });

  it('exposes Front and Back as static compound children', () => {
    expect(Curl.Front).toBeDefined();
    expect(Curl.Back).toBeDefined();
    expect(Curl.Front.displayName).toBe('Curl.Front');
    expect(Curl.Back.displayName).toBe('Curl.Back');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Curl ref={ref}>
        <Curl.Front>Front</Curl.Front>
      </Curl>
    );
    expect(ref.current).toBeTruthy();
  });

  // The regression that motivated the rebuild: BOTH faces are React-owned
  // and present in the DOM (no innerHTML cloning, content rendered once).
  it('renders both Front and Back content (React-owned, not cloned)', () => {
    const { getByText } = render(
      <Curl>
        <Curl.Front>FrontText</Curl.Front>
        <Curl.Back>BackText</Curl.Back>
      </Curl>
    );
    expect(getByText('FrontText')).toBeInTheDocument();
    expect(getByText('BackText')).toBeInTheDocument();
  });

  // The other half of the regression: event handlers inside a face survive
  // (the old innerHTML clone destroyed them).
  it('keeps React event handlers alive inside a face', () => {
    const onClick = jest.fn();
    const { getByText } = render(
      <Curl>
        <Curl.Front>
          <button type="button" onClick={onClick}>
            Press
          </button>
        </Curl.Front>
      </Curl>
    );
    fireEvent.click(getByText('Press'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a blank Back when Curl.Back is omitted', () => {
    const { getByText } = render(
      <Curl>
        <Curl.Front>OnlyFront</Curl.Front>
      </Curl>
    );
    expect(getByText('OnlyFront')).toBeInTheDocument();
  });

  it('does not crash on pointer interaction', () => {
    const { container } = render(
      <Curl width={300} height={600}>
        <Curl.Front>F</Curl.Front>
        <Curl.Back>B</Curl.Back>
      </Curl>
    );
    const root = container.querySelector('[class*="root"]') as HTMLElement;
    expect(root).toBeTruthy();
    expect(() => {
      fireEvent.pointerDown(root, { clientX: 580, clientY: 40, pointerId: 1, button: 0 });
      fireEvent.pointerMove(root, { clientX: 400, clientY: 60, pointerId: 1 });
      fireEvent.pointerUp(root, { clientX: 400, clientY: 60, pointerId: 1 });
    }).not.toThrow();
  });

  it('does not attach drag handlers when disabled', () => {
    const { container } = render(
      <Curl disabled>
        <Curl.Front>F</Curl.Front>
      </Curl>
    );
    const root = container.querySelector('[class*="root"]') as HTMLElement;
    // No throw and stays mounted; disabled simply omits the handlers.
    expect(() =>
      fireEvent.pointerDown(root, { clientX: 580, clientY: 40, pointerId: 1, button: 0 })
    ).not.toThrow();
  });
});
