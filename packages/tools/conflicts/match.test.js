import { describe, it, expect } from 'vitest';
import { parseTasklistImages, matchPowerTools } from './match.js';

describe('parseTasklistImages', () => {
  it('extracts the image name from each tasklist CSV line', () => {
    const out = '"svchost.exe","123","Services","0","12,345 K"\r\n"LenovoVantage-(LenovoGenericAddin).exe","456","Console","1","8 K"\r\n';
    expect(parseTasklistImages(out)).toEqual(['svchost.exe', 'LenovoVantage-(LenovoGenericAddin).exe']);
  });

  it('ignores blank lines and tolerates empty input', () => {
    expect(parseTasklistImages('\n\n')).toEqual([]);
    expect(parseTasklistImages('')).toEqual([]);
    expect(parseTasklistImages(null)).toEqual([]);
  });
});

describe('matchPowerTools', () => {
  it('detects Lenovo Vantage from its addin process names', () => {
    const imgs = ['svchost.exe', 'LenovoVantage-(LenovoDisplayAddin).exe', 'Lenovo.Modern.ImController.PluginHost.exe'];
    expect(matchPowerTools(imgs)).toEqual(['Lenovo Vantage']);
  });

  it('de-dupes when multiple processes match the same tool', () => {
    const imgs = ['LenovoVantage-(A).exe', 'LenovoVantage-(B).exe', 'imcontroller.exe'];
    expect(matchPowerTools(imgs)).toEqual(['Lenovo Vantage']);
  });

  it('detects several distinct tools and returns none when clean', () => {
    expect(matchPowerTools(['ArmouryCrate.exe', 'ThrottleStop.exe']).sort())
      .toEqual(['Armoury Crate', 'ThrottleStop']);
    expect(matchPowerTools(['chrome.exe', 'code.exe', 'node.exe'])).toEqual([]);
  });
});
