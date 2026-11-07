import { expect, test, type Page } from '@playwright/test'
import { GAME_CONFIG } from '../../src/config'

let errors: string[] = []

test.beforeEach(({ page }) => {
  errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

async function stroke(page: Page): Promise<void> {
  const canvas = page.locator('#boardHost canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('画板没有渲染出来')
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.4)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(
      box.x + box.width * (0.2 + i * 0.07),
      box.y + box.height * (0.4 + Math.sin(i) * 0.15),
    )
  }
  await page.mouse.up()
  await page.waitForTimeout(100)
}

test('hash 路由 / 未知路径回退 / 标题同步', async ({ page }) => {
  await page.goto('/#/undercover')
  await expect(page.locator('h1')).toHaveText('谁是卧底')
  await expect(page).toHaveTitle('谁是卧底 · 小游戏工具箱')

  await page.goto('/#/nope')
  await expect(page.locator('h1')).toHaveText('你画我猜')
  await expect(page).toHaveURL(/#\/draw-guess$/)

  await page.locator('.nav-item', { hasText: '谁是卧底' }).click()
  await expect(page).toHaveURL(/#\/undercover$/)
  await expect(page).toHaveTitle('谁是卧底 · 小游戏工具箱')
  await expect(page.locator('.nav-item.is-active')).toContainText('谁是卧底')
})

test('你画我猜：抽题 → 两轮 → 结果页 → 保存 / 放大 / 再玩一局', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.setup')).toBeVisible()
  await expect(page.locator('.nav-item')).toHaveCount(2)

  const topics = GAME_CONFIG.drawGuess.topics!
  const rounds = GAME_CONFIG.drawGuess.rounds!
  const phases = rounds * 2

  // 题目列表默认折叠，展开后可以直接指定
  const picker = page.locator('.topic-picker')
  await expect(picker).not.toHaveAttribute('open', '')
  await expect(page.locator('.topic-pick-item')).toHaveCount(topics.length)

  // 抽题动画结束后出结果
  await page.getByRole('button', { name: '抽', exact: true }).click()
  await expect(page.locator('.topic')).not.toHaveClass(/is-empty/, { timeout: 5_000 })
  await expect(page.getByRole('button', { name: '重来', exact: true })).toBeEnabled()

  // 手动指定一个题目
  await page.locator('.topic-picker summary').click()
  const lastItem = page.locator('.topic-pick-item').last()
  const lastTopic = (await lastItem.innerText()).replace(/^\d+\s*/, '').trim()
  await lastItem.click()
  await expect(page.locator('.topic')).toHaveText(lastTopic)
  await expect(page.locator('.topic-picker')).not.toHaveAttribute('open', '')
  await expect(page.locator('.topic-pick-item.is-active')).toHaveCount(1)

  // 选手名会在「确定」时提交
  await page.locator('#playerA').fill('小明')
  await page.locator('#playerB').fill('小红')

  await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.locator('.play')).toBeVisible()
  await expect(page.locator('.play-meta')).toContainText(`第 1 / ${rounds} 轮`)
  await expect(page.locator('.play-meta')).toContainText('A · 画图')
  await expect(page.locator('.play-meta')).toContainText('小明')
  await expect(page.locator('.timer-value')).toHaveText(/^\d{2}:\d{2}$/)
  await expect(page.locator('#boardHost canvas')).toBeVisible()

  // 走完所有阶段（每个阶段画一笔，避免触发空白确认）
  for (let i = 0; i < phases; i++) {
    await expect(page.locator('.play-meta')).toBeVisible()
    await stroke(page)
    await page.waitForTimeout(500)
    const next = page.locator('.play-actions .btn.primary')
    if (i === phases - 1) {
      await expect(next).toHaveText('完成猜词，查看作品')
    }
    const before = await page.locator('.play-meta').innerText()
    await next.click()
    if (i < phases - 1) {
      await expect(page.locator('.play-meta')).not.toHaveText(before)
    }
  }

  await expect(page.locator('.result')).toBeVisible()
  await expect(page.locator('.artwork-card')).toHaveCount(phases)
  await expect(page.locator('.result-topic')).toHaveText(lastTopic)
  await expect(page.locator('.artwork-card img')).toHaveCount(phases)

  // 单张保存
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.artwork-card .btn', { hasText: '保存这张' }).first().click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^第1轮-A画图-.+\.png$/)

  // 图片放大 + Esc 关闭
  await page.locator('.artwork-card img').first().click()
  await expect(page.locator('.lightbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.lightbox')).toHaveCount(0)

  // 再玩一局
  await page.getByRole('button', { name: '再玩一局（重新抽题）' }).click()
  await expect(page.locator('.setup')).toBeVisible()
  await expect(page.locator('.artwork-card')).toHaveCount(0)
  await expect(page.locator('.topic-pick-item.is-active')).toHaveCount(0)
})

test('你画我猜：空白画板要确认，暂停会冻住倒计时', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '抽', exact: true }).click()
  await expect(page.locator('.topic')).not.toHaveClass(/is-empty/, { timeout: 5_000 })
  await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.locator('.play')).toBeVisible()
  await page.waitForTimeout(500)

  // 空白时点下一步 -> 弹出确认框，取消后仍在 A 阶段
  let dialogMessage = ''
  page.once('dialog', async (dialog) => {
    dialogMessage = dialog.message()
    await dialog.dismiss()
  })
  await page.locator('.play-actions .btn.primary').click()
  await expect(page.locator('.play-meta')).toContainText('A · 画图')
  expect(dialogMessage).toContain('画板还是空白的')

  // 暂停后倒计时不再变化，继续后恢复
  await page.getByRole('button', { name: '暂停', exact: true }).click()
  await expect(page.locator('.board-paused')).toBeVisible()
  const frozen = await page.locator('.timer-value').innerText()
  await page.waitForTimeout(1_500)
  expect(await page.locator('.timer-value').innerText()).toBe(frozen)

  await page.getByRole('button', { name: '继续', exact: true }).click()
  await expect(page.locator('.board-paused')).toBeHidden()
  await page.waitForTimeout(1_500)
  expect(await page.locator('.timer-value').innerText()).not.toBe(frozen)
})

test('你画我猜：时间到自动进入下一阶段', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')

  await page.getByRole('button', { name: '抽', exact: true }).click()
  await page.clock.fastForward(1_000)
  await expect(page.locator('.topic')).not.toHaveClass(/is-empty/)

  await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.locator('.play')).toBeVisible()

  await page.clock.fastForward((GAME_CONFIG.drawGuess.timer?.a ?? 60) * 1000 + 500)
  await expect(page.locator('.timeup')).toBeVisible()
  await expect(page.locator('.timeup .sub')).toContainText('画图时间结束了')

  await page.clock.fastForward(1_700)
  await expect(page.locator('.play-meta')).toContainText('B · 猜词')
  await expect(page.locator('.timeup')).toHaveCount(0)
})

test('谁是卧底：抽题 → 查看 → 发牌 → 按住看词 → 一键翻开', async ({ page }) => {
  await page.goto('/#/undercover')
  await expect(page.locator('.uc-setup')).toBeVisible()
  await expect(page.locator('#ucCount')).toHaveValue('4')
  await expect(page.locator('.uc-name-field input')).toHaveCount(4)

  // 人数步进
  await page.locator('.uc-step-btn', { hasText: '+' }).click()
  await expect(page.locator('#ucCount')).toHaveValue('5')
  await expect(page.locator('.uc-name-field input')).toHaveCount(5)
  await expect(page.locator('.uc-step-btn', { hasText: '−' })).toBeEnabled()

  // 抽题默认藏起来，主持人可以查看
  await page.getByRole('button', { name: '抽题', exact: true }).click()
  await expect(page.locator('.uc-topic')).toHaveClass(/is-hidden/)
  await expect(page.locator('.uc-topic')).not.toContainText('卧底')
  await page.getByRole('button', { name: '👀 查看本题' }).click()
  await expect(page.locator('.uc-topic')).toHaveClass(/is-shown/)
  await expect(page.locator('.uc-topic')).toContainText('卧底')
  await expect(page.locator('.uc-topic')).toContainText('普通玩家')

  // 发牌前先藏回去，避免围观的人看到
  await page.getByRole('button', { name: '🙈 隐藏本题' }).click()
  await expect(page.locator('.uc-topic')).toHaveClass(/is-hidden/)

  // 发牌
  await page.getByRole('button', { name: /开始发牌/ }).click()
  await expect(page.locator('.uc-reveal')).toBeVisible()
  await expect(page.locator('.uc-card')).toHaveCount(5)
  await expect(page.locator('.uc-banner')).toHaveCount(0)

  // 按住查看第一张
  const hold = page.locator('.uc-hold-btn').first()
  const box = await hold.boundingBox()
  if (!box) throw new Error('按住按钮没有渲染出来')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(page.locator('.uc-card').first()).toHaveClass(/is-open/)
  await page.mouse.up()
  await expect(page.locator('.uc-card').first()).not.toHaveClass(/is-open/)
  await expect(page.locator('.uc-card-seen').first()).toBeVisible()

  // 一键翻开 / 扣上
  await page.getByRole('button', { name: /一键翻开全部卡片/ }).click()
  await expect(page.locator('.uc-card.is-open')).toHaveCount(5)
  await expect(page.locator('.uc-card.is-spy')).toHaveCount(1)
  await expect(page.locator('.uc-banner')).toBeVisible()
  await expect(page.locator('.uc-banner')).toContainText('本局卧底是')
  await page.getByRole('button', { name: /一键扣上全部卡片/ }).click()
  await expect(page.locator('.uc-card.is-open')).toHaveCount(0)

  // 返回设置
  await page.getByRole('button', { name: '返回设置' }).click()
  await expect(page.locator('.uc-setup')).toBeVisible()
  await expect(page.locator('.uc-topic')).toHaveClass(/is-hidden/)
})

test('刷新不丢进度：你画我猜恢复阶段、选手名与笔迹', async ({ page }) => {
  await page.goto('/')

  await page.locator('.topic-picker summary').click()
  const lastItem = page.locator('.topic-pick-item').last()
  await lastItem.click()
  await page.locator('#playerA').fill('刷新A')
  await page.locator('#playerB').fill('刷新B')
  await page.getByRole('button', { name: '确定', exact: true }).click()

  await expect(page.locator('.play')).toBeVisible()
  await stroke(page)
  await page.waitForTimeout(500)

  await page.reload()
  await expect(page.locator('.play')).toBeVisible()
  await expect(page.locator('.play-meta')).toContainText('第 1 / ' + GAME_CONFIG.drawGuess.rounds + ' 轮')
  await expect(page.locator('.play-meta')).toContainText('A · 画图')
  await expect(page.locator('.play-meta')).toContainText('刷新A')

  // 画板上的笔迹要一起恢复（白色背景 + 笔迹）
  await expect.poll(async () => page.locator('#boardHost canvas').evaluate((el) => {
    const canvas = el as HTMLCanvasElement
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) return true
    }
    return false
  })).toBe(true)

  // 继续推进：作品照常捕获，题目仍然是刷新前那一题
  await page.waitForTimeout(500)
  await page.locator('.play-actions .btn.primary').click()
  await expect(page.locator('.play-meta')).toContainText('B · 猜词')

  await page.reload()
  await expect(page.locator('.play-meta')).toContainText('B · 猜词')
  await expect(page.locator('.ref-img')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '结束本局' }).click()
  await expect(page.locator('.result')).toBeVisible()
  await expect(page.locator('.artwork-card')).toHaveCount(1)
})

test('刷新不丢进度：谁是卧底恢复发牌与已查看 / 已翻开状态', async ({ page }) => {
  await page.goto('/#/undercover')
  await page.locator('.uc-step-btn', { hasText: '+' }).click()
  await page.locator('.uc-name-field input').first().fill('阿一')
  await page.getByRole('button', { name: '抽题', exact: true }).click()
  await page.getByRole('button', { name: /开始发牌/ }).click()

  await expect(page.locator('.uc-reveal')).toBeVisible()
  await expect(page.locator('.uc-card')).toHaveCount(5)

  const hold = page.locator('.uc-hold-btn').first()
  const box = await hold.boundingBox()
  if (!box) throw new Error('按住按钮没有渲染出来')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(page.locator('.uc-card').first()).toHaveClass(/is-open/)
  await page.mouse.up()
  await expect(page.locator('.uc-card-seen').first()).toBeVisible()

  await page.getByRole('button', { name: /一键翻开全部卡片/ }).click()
  const spyName = (await page.locator('.uc-banner b').innerText()).trim()
  await expect(page.locator('.uc-banner')).toBeVisible()

  await page.reload()
  await expect(page.locator('.uc-reveal')).toBeVisible()
  await expect(page.locator('.uc-card')).toHaveCount(5)
  await expect(page.locator('.uc-card-seen').first()).toBeVisible()
  await expect(page.locator('.uc-banner')).toBeVisible()
  await expect(page.locator('.uc-banner b')).toHaveText(spyName)
})

test('窄屏：抽屉可以打开并点遮罩关闭', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.menu-btn')).toBeVisible()

  await page.locator('.menu-btn').click()
  await expect(page.locator('body')).toHaveClass(/nav-open/)
  await expect(page.locator('.sidebar')).toBeVisible()

  await page.locator('.backdrop').click({ position: { x: 380, y: 400 } })
  await expect(page.locator('body')).not.toHaveClass(/nav-open/)
})
