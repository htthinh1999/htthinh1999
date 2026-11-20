import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { renderHeader, typingTimeline } from '../lib/header.mjs';
import { renderStack, textWidth } from '../lib/stack.mjs';
import { buildModel } from '../lib/model.mjs';
import { CARDS } from '../lib/render.mjs';
import { THEMES } from '../lib/theme.mjs';

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const raw = JSON.parse(readFileSync(new URL('../fixtures/sample-raw.json', import.meta.url), 'utf8'));
const model = buildModel(raw, config, new Date(raw.now));

/** Small well-formedness check: balanced tags, quoted attributes, escaped "&". */
function assertWellFormedSvg(xml) {
  assert.match(xml, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  const tag = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/g;
  const stack = [];
  let last = 0;
  for (let m = tag.exec(xml); m; m = tag.exec(xml)) {
    const between = xml.slice(last, m.index);
    assert.ok(!between.includes('<'), `malformed markup near: ${between.slice(-60)}`);
    last = tag.lastIndex;
    if (m[0].startsWith('<!--')) continue;
    const [, closing, name, , selfClosing] = m;
    if (closing) assert.equal(stack.pop(), name, `unexpected </${name}>`);
    else if (!selfClosing) stack.push(name);
  }
  assert.ok(!xml.slice(last).includes('<'), 'trailing malformed markup');
  assert.deepEqual(stack, [], 'unclosed elements');
  assert.doesNotMatch(xml, /&(?!amp;|lt;|gt;|quot;|#39;)/, 'unescaped "&"');
}

describe('metric cards', () => {
  for (const [card, render] of Object.entries(CARDS)) {
    for (const theme of Object.values(THEMES)) {
      test(`${card} (${theme.name}) renders valid SVG`, () => {
        const svg = render(model, theme);
        assertWellFormedSvg(svg);
        assert.doesNotMatch(svg, /NaN|undefined|Infinity|\[object/);
        assert.match(svg, /<title id="title">/);
      });
    }
  }

  test('never leaks repository names into cards or metrics.json', () => {
    const outputs = Object.values(CARDS).flatMap((render) =>
      Object.values(THEMES).map((theme) => render(model, theme)),
    );
    outputs.push(JSON.stringify(model));
    for (const output of outputs) assert.doesNotMatch(output, /sample\/repo-/);
  });

  test('renders empty states without errors', () => {
    const empty = buildModel(
      {
        ...raw,
        contributionYears: [],
        repositories: [],
        commitTimestamps: [],
        user: { ...raw.user, privateRepos: { totalCount: 0 } },
      },
      config,
      new Date(raw.now),
    );
    for (const render of Object.values(CARDS)) {
      const svg = render(empty, THEMES.dark);
      assertWellFormedSvg(svg);
      assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
    }
    assert.match(CARDS.overview(empty, THEMES.dark), /Issues opened/); // public-only fallback row
  });

  test('escapes user-controlled text', () => {
    const tricky = { ...model, name: 'A & <B>', languages: { repoCount: 1, items: [{ name: 'C<>&', color: '#fff', percent: 100 }] } };
    for (const render of Object.values(CARDS)) assertWellFormedSvg(render(tricky, THEMES.light));
  });
});

describe('header', () => {
  for (const theme of Object.values(THEMES)) {
    test(`renders valid SVG (${theme.name})`, () => {
      const svg = renderHeader(config.header, theme);
      assertWellFormedSvg(svg);
      assert.doesNotMatch(svg, /NaN|undefined/);
    });
  }

  test('typing keyframes are monotonic and within the cycle', () => {
    const { events, total } = typingTimeline(config.header.roles);
    assert.equal(events[0].t, 0);
    for (let i = 1; i < events.length; i += 1) assert.ok(events[i].t > events[i - 1].t);
    assert.ok(events.at(-1).t < total);
    assert.equal(events.at(-1).chars, 0); // ends erased so the loop restarts cleanly
  });
});

describe('stack', () => {
  for (const theme of Object.values(THEMES)) {
    test(`renders valid SVG (${theme.name})`, () => {
      const svg = renderStack(config.stack, theme);
      assertWellFormedSvg(svg);
      assert.doesNotMatch(svg, /NaN|undefined/);
      for (const group of config.stack) for (const item of group.items) assert.ok(svg.includes(item.replace('&', '&amp;')));
    });
  }

  test('wraps chips that overflow the card width', () => {
    const many = [{ label: 'Lots', items: Array.from({ length: 14 }, (_, i) => `Technology ${i}`) }];
    const svg = renderStack(many, THEMES.dark);
    const height = Number(svg.match(/height="(\d+(?:\.\d+)?)"/)[1]);
    assert.ok(height > 22 + 40 * 2, 'expected more than one chip row');
  });

  test('estimates wider text for longer labels', () => {
    assert.ok(textWidth('GitHub Actions') > textWidth('Helm'));
  });
});
