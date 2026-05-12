import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { CuratedHomeComments } from '../components/home/CuratedHomeComments'

const baseComment = {
  id: 'comment-1',
  body: 'Clean print with a useful orientation note.',
  modelId: 'model-1',
  modelTitle: 'Desk Hook',
  userDisplayName: 'Alex',
  userProfileSlug: null,
  userAvatarUrl: null,
}

test('renders a linked thumbnail for curated comments with images', () => {
  const html = renderToStaticMarkup(
    <CuratedHomeComments
      comments={[
        {
          ...baseComment,
          imageUrl: '/files/comments/comment-1.webp',
          imageStatus: 'ready',
        },
      ]}
    />,
  )

  assert.match(html, /href="\/models\/model-1"/)
  assert.match(html, /src="\/files\/comments\/comment-1.webp"/)
  assert.match(html, /alt="Desk Hook community make"/)
})

test('does not render a thumbnail placeholder for comments without images', () => {
  const html = renderToStaticMarkup(
    <CuratedHomeComments
      comments={[
        {
          ...baseComment,
          imageUrl: null,
          imageStatus: null,
        },
      ]}
    />,
  )

  assert.doesNotMatch(html, /community make/)
  assert.match(html, /Clean print with a useful orientation note/)
})
