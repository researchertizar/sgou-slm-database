const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('Telemetry UX & Search Optimization Suite', async (t) => {
  const scriptJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'script.js'), 'utf8');
  const readerHtml = fs.readFileSync(path.join(__dirname, '..', 'reader.html'), 'utf8');
  const styleCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

  await t.test('1. AcademicQueryParser exists and normalizes course codes, degrees, and semesters', () => {
    assert.match(scriptJs, /class\s+AcademicQueryParser/, 'Must define AcademicQueryParser class');
    assert.match(scriptJs, /normalizeCode\s*\(/, 'Must have normalizeCode method');
    assert.match(scriptJs, /getDegreeAcronyms\s*\(/, 'Must have getDegreeAcronyms method');
    assert.match(scriptJs, /getSemSynonyms\s*\(/, 'Must have getSemSynonyms method');
    assert.match(scriptJs, /parse\s*\(/, 'Must have parse method');
  });

  await t.test('2. Course code normalizer and query parser resolve all 10 telemetry queries in catalog', () => {
    const slmData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sgou_slm_data.json'), 'utf8'));
    const qData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sgou_questions_cleaned.json'), 'utf8'));

    const qProgMap = new Map();
    qData.forEach(p => {
      const title = (p.course_title || p.programme_name || '').toLowerCase().trim();
      if (title) qProgMap.set(title, p);
    });

    // Extract AcademicQueryParser logic from scriptJs
    const parserMatch = scriptJs.match(/class\s+AcademicQueryParser\s*\{([\s\S]*?)\n\}/);
    assert.ok(parserMatch, 'Could not extract AcademicQueryParser');
    const parserFn = new Function(`return class AcademicQueryParser {${parserMatch[1]}}`)();

    const idx = [];
    slmData.forEach(progRecord => {
      const qProg = qProgMap.get(progRecord.programme_name.toLowerCase().trim());
      const progAcrs = parserFn.getDegreeAcronyms(progRecord.programme_name);

      progRecord.semesters.forEach(sem => {
        const semSyn = parserFn.getSemSynonyms(sem.semester);
        sem.courses.forEach(course => {
          if (!course.code) return;
          const codeVariants = parserFn.normalizeCode(course.code).join(' ');
          idx.push({
            type: 'SLM',
            code: course.code,
            name: course.name,
            progName: progRecord.programme_name,
            tokens: `${course.code} ${codeVariants} ${course.name} ${progRecord.programme_name} ${progAcrs} ${progRecord.level} ${sem.semester} ${semSyn} slm textbook book material text`.toLowerCase()
          });
        });

        let asgns = [];
        if (qProg && qProg.assignments) {
          asgns = qProg.assignments.filter(a => {
            const sNorm = (a.semester || '').toUpperCase().trim();
            return sNorm === sem.semester || sNorm === 'SEMESTER ' + sem.semester.slice(1);
          });
        }

        asgns.forEach(asgn => {
          idx.push({
            type: 'ASSIGNMENT',
            code: 'BOOKLET',
            name: asgn.clean_title || asgn.title || 'Assignment',
            progName: progRecord.programme_name,
            tokens: `${asgn.title || ''} ${asgn.clean_title || ''} ${progRecord.programme_name} ${progAcrs} ${progRecord.level} ${sem.semester} ${semSyn} assignment booklet cia continuous assessment questions question`.toLowerCase()
          });
        });
      });
    });

    const targetQueries = [
      'm2ml04dc',
      'ml21',
      'm26ml',
      'm22ml04dc',
      'm22ml03dc',
      'b24uc03se',
      'bba',
      'first semister ba sociology text',
      'assignment questions of2',
      'assignment questions of2nd sem'
    ];

    targetQueries.forEach(query => {
      const parsed = parserFn.parse(query);
      const tokens = parsed.split(/\s+/).filter(Boolean);
      const matches = idx.filter(item => tokens.every(t => item.tokens.includes(t)));
      assert.ok(matches.length > 0, `Query "${query}" (parsed: "${parsed}") must produce at least 1 match. Got 0.`);
    });
  });

  await t.test('3. reader.html: Low RAM DPR capping, 3-page virtualization window, and 220ms zoom debounce', () => {
    assert.match(readerHtml, /memoryTier\s*<=\s*2\s*\?\s*1\.25/, 'Must cap DPR to 1.25x on <= 2GB RAM devices');
    assert.match(readerHtml, /memoryTier\s*<=\s*4\s*\?\s*1\.5/, 'Must cap DPR to 1.5x on <= 4GB RAM devices');
    assert.match(readerHtml, /Math\.abs\s*\(\s*pageNum\s*-\s*currentPage\s*\)\s*>\s*2/, 'Must virtualize pages > 2 away from active page');
    assert.match(readerHtml, /oldCanvas\.width\s*=\s*1;\s*oldCanvas\.height\s*=\s*1;/, 'Must clear canvas memory buffer on virtualized pages');
    assert.match(readerHtml, /reRenderVisiblePages\(\);\s*\}\s*,\s*220\);/, 'Must debounce visible page re-renders by 220ms');
  });

  await t.test('4. css/style.css: Tactile active states, content-visibility, and download spinner', () => {
    assert.match(styleCss, /\.search-result-item:active\s*\{/, 'Must have active state for search-result-item');
    assert.match(styleCss, /\.card-header:active\s*\{/, 'Must have active state for card-header');
    assert.match(styleCss, /\.sem-tab:active\s*\{/, 'Must have active state for sem-tab');
    assert.match(styleCss, /content-visibility:\s*auto;/, 'Must use content-visibility: auto for collapsed accordion performance');
    assert.match(styleCss, /\.vp-btn\.is-downloading\s+svg\s*\{[\s\S]*?animation:\s*vpDownloadSpin/, 'Must animate rotating download spinner');
  });

  await t.test('5. script.js: Search result card tap delegation and pointerdown blur guard', () => {
    assert.match(scriptJs, /e\.target\.closest\('\.search-result-item'\)/, 'Must handle tap on search-result-item');
    assert.match(scriptJs, /itemBtn\.click\(\)/, 'Must forward card tap to in-card .btn-view');
    assert.match(scriptJs, /recent\.addEventListener\('pointerdown'/, 'Must prevent input blur on recent searches');
    assert.match(scriptJs, /searchResults\.addEventListener\('pointerdown'/, 'Must prevent input blur on search results');
    assert.match(scriptJs, /dlBtn\.classList\.add\('is-downloading'\)/, 'Must set optimistic is-downloading state on viewer download button');
  });

  await t.test('6. Zero-Emoji Compliance across reader.html, js/script.js, and css/style.css', () => {
    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    const files = [
      { name: 'reader.html', content: readerHtml },
      { name: 'js/script.js', content: scriptJs },
      { name: 'css/style.css', content: styleCss }
    ];

    files.forEach(f => {
      const match = f.content.match(emojiRegex);
      assert.strictEqual(match, null, `File ${f.name} violates Zero-Emoji rule with character "${match?.[0]}"`);
    });
  });
});
