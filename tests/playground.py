"""Optional browser smoke test; requires Python playwright and installed Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import os
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_BIN','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((Path(__file__).resolve().parents[1]/'playground.html').read_text())
    expect(page.locator('.route')).to_have_text('Focalizada')
    page.get_by_role('button',name='Simular native (1 firmas)').first.click()
    expect(page.locator('.route')).to_have_text('Directa')
    assert '"remainingBudget": "18"' in page.locator('#input').input_value()
    page.locator('#fixture').select_option('incomplete');expect(page.locator('.route')).to_have_text('Abstención')
    assert page.get_by_role('button',name='Simular',exact=False).count()==0
    page.locator('#fixture').select_option('joint_plan');expect(page.locator('.route')).to_have_text('Exploratoria')
    page.get_by_role('button',name='Simular v0 (2 firmas)').first.click();expect(page.locator('.route')).to_have_text('Focalizada')
    page.get_by_role('button',name='Simular v1 (1 firmas)').click();expect(page.locator('.route')).to_have_text('Directa')
    page.locator('#input').fill('{');page.locator('#run').click();expect(page.locator('#result')).to_contain_text('Entrada inválida')
    page.locator('#fixture').select_option('blocked');expect(page.locator('.route')).to_have_text('Abstención')
    assert page.get_by_role('button',name='Simular',exact=False).count()==0
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'mobile horizontal overflow'
    assert not errors, errors
    browser.close()
print('Chromium: initial route, simulated evidence and budget, incomplete coverage, XOR reentry, invalid JSON, blocked gate, mobile overflow, no page errors: PASS')
