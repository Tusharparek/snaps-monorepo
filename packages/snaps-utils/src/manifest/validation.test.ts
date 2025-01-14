import { assert, is, size, string, StructError } from 'superstruct';

import { getSnapManifest } from '../test-utils';
import {
  assertIsSnapManifest,
  base64,
  Base64Opts,
  Bip32EntropyStruct,
  Bip32PathStruct,
  createSnapManifest,
  isSnapManifest,
} from './validation';

describe('base64', () => {
  it.each([
    ['abcd', undefined],
    ['abcd', { paddingRequired: true }],
    ['ab', undefined],
    ['ab==', undefined],
    ['ab==', { paddingRequired: true }],
    ['abc', undefined],
    ['abc=', undefined],
    ['abc=', { paddingRequired: true }],
    [
      'abcdefghijklmnopqrstuvwxyzABCDEFGHJIKLMNOPQRSTUVXYZ01234567890+/',
      undefined,
    ],
    [
      'abcdefghijklmnopqrstuvwxyzABCDEFGHJIKLMNOPQRSTUVXYZ01234567890-_',
      { characterSet: 'base64url' },
    ] as const,
  ] as [string, Base64Opts | undefined][])(
    'validates valid base64',
    (value, opts) => {
      const struct = base64(string(), opts);
      expect(is(value, struct)).toBe(true);
    },
  );

  it.each([
    ['ab', { paddingRequired: true }],
    ['abc', { paddingRequired: true }],
    ['a', undefined],
    ['aaaaa', undefined],
    [String.raw`\\\\`, undefined],
    ['ab=', undefined],
    ['ab=', { paddingRequired: true }],
    ['abc==', undefined],
    ['abc==', { paddingRequired: true }],
    [',.', undefined],
    [',.', { characterSet: 'base64url' }] as const,
    [
      'abcdefghijklmnopqrstuvwxyzABCDEFGHJIKLMNOPQRSTUVXYZ01234567890-_',
      undefined,
    ],
    [
      'abcdefghijklmnopqrstuvwxyzABCDEFGHJIKLMNOPQRSTUVXYZ01234567890+/',
      { characterSet: 'base64url' },
    ],
  ] as [string, Base64Opts | undefined][])(
    "doesn't validate invalid bas64",
    (value, opts) => {
      const struct = base64(string(), opts);
      expect(is(value, struct)).toBe(false);
    },
  );

  it('respects string() constraints', () => {
    const struct = base64(size(string(), 4, 4));
    expect(is('abcd', struct)).toBe(true);
    expect(is('abcdabcd', struct)).toBe(false);
  });
});

describe('Bip32PathStruct', () => {
  it.each(['m/0/1/2', "m/0'/1/2", "m/1'/2'/3'/4/5/6", "m/0/1'/2"])(
    'validates correctly',
    (path) => {
      expect(is(path.split('/'), Bip32PathStruct)).toBe(true);
    },
  );

  it('requires an array', () => {
    expect(is(['m', "0'", '123'], Bip32PathStruct)).toBe(true);
    expect(is("m/0'/123", Bip32PathStruct)).toBe(false);
    expect(is(42, Bip32PathStruct)).toBe(false);
  });

  it('requires an non-empty array', () => {
    expect(() => assert([], Bip32PathStruct)).toThrow('non-empty');
  });

  it('requires "m" as first argument', () => {
    expect(() => assert(['a'], Bip32PathStruct)).toThrow(
      'Path must start with "m"',
    );

    expect(() => assert(['a', "0'", '123'], Bip32PathStruct)).toThrow(
      'Path must start with "m"',
    );
  });

  it('requires length >= 3', () => {
    expect(() => assert(['m', "0'", '123'], Bip32PathStruct)).not.toThrow();
    expect(() =>
      assert(['m', "0'", '123', '456'], Bip32PathStruct),
    ).not.toThrow();

    expect(() => assert(['m', "0'"], Bip32PathStruct)).toThrow(
      'length of at least three',
    );

    expect(() => assert(['m'], Bip32PathStruct)).toThrow(
      'length of at least three',
    );
  });

  it.each(["m/0'/123/asd", 'm/0"/123', 'm/1/2/3/_', "m/1'/2'/3'/-1"])(
    'requires numbers or hardened numbers',
    (path) => {
      expect(() => assert(path.split('/'), Bip32PathStruct)).toThrow(
        'Path must be a valid BIP-32 derivation path array.',
      );
    },
  );

  it('throws for forbidden paths', () => {
    expect(() => assert(['m', "1399742832'", '0'], Bip32PathStruct)).toThrow(
      'The purpose "1399742832\'" is not allowed for entropy derivation.',
    );
  });
});

describe('Bip32EntropyStruct', () => {
  it('works with ed25519', () => {
    expect(
      is(
        { path: "m/0'/1'/2'".split('/'), curve: 'ed25519' },
        Bip32EntropyStruct,
      ),
    ).toBe(true);
  });

  it('ed25519 requires hardened paths', () => {
    expect(() =>
      assert(
        { path: "m/0'/1'/2'/3".split('/'), curve: 'ed25519' },
        Bip32EntropyStruct,
      ),
    ).toThrow('Ed25519 does not support unhardened paths.');
  });

  it('works with secp256k1', () => {
    expect(
      is(
        { path: 'm/0/1/2'.split('/'), curve: 'secp256k1' },
        Bip32EntropyStruct,
      ),
    ).toBe(true);
  });

  it.each([1, '', 'asd', {}, null, undefined])(
    'requires valid curve',
    (curve) => {
      expect(
        is({ path: "m/0'/1'/2'".split('/'), curve }, Bip32EntropyStruct),
      ).toBe(false);
    },
  );

  it.each([42, "m/0'/123/asd".split('/')])('requires valid path', (path) => {
    expect(is({ path, curve: 'secp256k1' }, Bip32EntropyStruct)).toBe(false);
  });

  it.each([undefined, null, {}, { asd: 123 }])(
    'requires valid structure',
    (value) => {
      expect(is(value, Bip32EntropyStruct)).toBe(false);
    },
  );
});

describe('isSnapManifest', () => {
  it('returns true for a valid snap manifest', () => {
    expect(isSnapManifest(getSnapManifest())).toBe(true);
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'foo',
    [],
    {},
    { name: 'foo' },
    { version: '1.0.0' },
    getSnapManifest({ version: 'foo bar' }),
  ])('returns false for an invalid snap manifest', (value) => {
    expect(isSnapManifest(value)).toBe(false);
  });
});

describe('assertIsSnapManifest', () => {
  it('does not throw for a valid snap manifest', () => {
    expect(() => assertIsSnapManifest(getSnapManifest())).not.toThrow();
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'foo',
    [],
    {},
    { name: 'foo' },
    { version: '1.0.0' },
    getSnapManifest({ version: 'foo bar' }),
  ])('throws for an invalid snap manifest', (value) => {
    expect(() => assertIsSnapManifest(value)).toThrow(
      '"snap.manifest.json" is invalid:',
    );
  });
});

describe('createSnapManifest', () => {
  it('does not throw for a valid snap manifest', () => {
    expect(() => createSnapManifest(getSnapManifest())).not.toThrow();
  });

  it('coerces source paths', () => {
    expect(
      createSnapManifest(
        getSnapManifest({ filePath: './bundle.js', iconPath: './icon.svg' }),
      ),
    ).toStrictEqual(
      getSnapManifest({ filePath: 'bundle.js', iconPath: 'icon.svg' }),
    );
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'foo',
    [],
    {},
    { name: 'foo' },
    { version: '1.0.0' },
    getSnapManifest({ version: 'foo bar' }),
  ])('throws for an invalid snap manifest', (value) => {
    expect(() => createSnapManifest(value)).toThrow(StructError);
  });
});
