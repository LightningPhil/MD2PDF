// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {paginate} from '../src/paginator';

// A deterministic measurement adapter exercises the paginator's branching and
// conservation of content. This does not claim to validate browser typography.
function height(element: Element): number {
  if (element.hasAttribute('data-height')) return Number(element.getAttribute('data-height'));
  if (['P','LI','H1','H2','A'].includes(element.tagName)) return Math.max(20,Math.ceil((element.textContent||'').length/20)*20);
  return Array.from(element.children).reduce((total,child)=>total+height(child),0);
}
describe('pagination content conservation with controlled measurements',()=>{
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollHeight');
  beforeEach(()=>Object.defineProperty(HTMLElement.prototype,'scrollHeight',{configurable:true,get(){return height(this);}}));
  afterEach(()=>{if(original) Object.defineProperty(HTMLElement.prototype,'scrollHeight',original); else Reflect.deleteProperty(HTMLElement.prototype,'scrollHeight');});
  const root=(html:string)=>{const element=document.createElement('div');element.innerHTML=html;return element;};
  const text=(pages:HTMLElement[])=>pages.map(page=>page.textContent).join('');
  it('creates an exact page count without losing or reordering blocks',()=>{
    const content=root('<p data-height="40">One</p><p data-height="40">Two</p><p data-height="40">Three</p>');
    const pages=paginate(content,80);
    expect(pages).toHaveLength(2);expect(text(pages)).toBe(content.textContent);
    expect(pages[0].textContent).toBe('OneTwo');expect(pages[1].textContent).toBe('Three');
  });
  it('moves a heading with its following paragraph',()=>{
    const pages=paginate(root('<p data-height="60">Opening</p><h2 data-height="20">Method</h2><p data-height="40">Explanation</p>'),80);
    expect(pages).toHaveLength(2);expect(pages[1].innerHTML).toContain('<h2');expect(pages[0].textContent).toBe('Opening');
  });
  it('preserves mixed paragraph text and formatting when splitting',()=>{
    const content=root('<p>Before '.repeat(1)+'<strong>bold words</strong> then '+ 'more words '.repeat(14)+'<em>italics</em> and the final words.</p>');
    const pages=paginate(content,80);
    expect(pages.length).toBeGreaterThan(1);expect(text(pages)).toBe(content.textContent);
    expect(pages.map(p=>p.querySelectorAll('strong').length).reduce((a,b)=>a+b)).toBeGreaterThan(0);
  });
  it('preserves text surrounding child blocks in mixed containers',()=>{
    const content=root('<section>Introduction <p>'+ 'words '.repeat(20)+'</p>Between<p>Second block</p>Trailing text</section>');
    const pages=paginate(content,80);expect(text(pages)).toBe(content.textContent);
  });
  it('continues ordered list numbers and preserves all items',()=>{
    const content=root('<ol start="5"><li>First</li><li>Second</li><li>Third</li><li>Fourth</li></ol>');
    const pages=paginate(content,40);expect(pages).toHaveLength(2);
    expect(pages[1].querySelector('ol')?.getAttribute('start')).toBe('7');expect(text(pages)).toBe(content.textContent);
  });
  it('keeps oversized atomic content intact for diagnostics to reject',()=>{
    const content=root('<table data-height="200"><tbody><tr><td>All rows retained</td></tr></tbody></table>');
    const pages=paginate(content,80);expect(pages).toHaveLength(1);expect(pages[0].querySelectorAll('table')).toHaveLength(1);expect(text(pages)).toBe(content.textContent);
  });
  it('splits a long contents navigation while preserving link targets',()=>{
    const content=root('<nav class="document-toc"><h2>Contents</h2>'+Array.from({length:10},(_,i)=>`<a href="#section-${i}">Section ${i}</a>`).join('')+'</nav>');
    const pages=paginate(content,80);expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap(p=>Array.from(p.querySelectorAll('a')).map(a=>a.getAttribute('href')))).toEqual(Array.from({length:10},(_,i)=>`#section-${i}`));
  });
  it('does not generate blank pages from repeated or edge breaks',()=>{
    const pages=paginate(root('<div data-page-break="true"></div><p>A</p><div data-page-break="true"></div><div data-page-break="true"></div><p>B</p><div data-page-break="true"></div>'),100);
    expect(pages).toHaveLength(2);expect(text(pages)).toBe('AB');
  });
});
