import React from 'react';
import { Curl } from './Curl';

export default { title: 'Curl' };

function Filler({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 40,
        fontWeight: 700,
        color: '#fff',
        background: color,
      }}
    >
      {label}
    </div>
  );
}

export function Usage() {
  return (
    <div style={{ padding: 60 }}>
      <Curl width={300} height={420}>
        <Curl.Front>
          <Filler label="Front A" color="#4263eb" />
        </Curl.Front>
        <Curl.Back>
          <Filler label="Back B" color="#e8590c" />
        </Curl.Back>
      </Curl>
      <p style={{ marginTop: 16, color: '#868e96' }}>
        Grab the right edge (top or bottom) and drag toward the left to curl.
      </p>
    </div>
  );
}

export function BlankBack() {
  return (
    <div style={{ padding: 60 }}>
      <Curl width={300} height={420}>
        <Curl.Front>
          <Filler label="Front only" color="#2b8a3e" />
        </Curl.Front>
      </Curl>
    </div>
  );
}

export function TextContent() {
  return (
    <div style={{ padding: 60 }}>
      <Curl width={320} height={440} pageBackground="#fff7e6">
        <Curl.Front align={{ horizontal: 'start', vertical: 'start' }}>
          <div style={{ padding: 24 }}>
            <h2>Chapter One</h2>
            <p>Drag the corner to turn the page.</p>
          </div>
        </Curl.Front>
        <Curl.Back align={{ horizontal: 'start', vertical: 'start' }}>
          <div style={{ padding: 24 }}>
            <h3>The other side</h3>
            <p>This is the back of the sheet.</p>
          </div>
        </Curl.Back>
      </Curl>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ padding: 60 }}>
      <Curl width={300} height={420} disabled>
        <Curl.Front>
          <Filler label="Static" color="#868e96" />
        </Curl.Front>
        <Curl.Back>
          <Filler label="Back" color="#495057" />
        </Curl.Back>
      </Curl>
    </div>
  );
}
