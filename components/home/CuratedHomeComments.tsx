import Link from 'next/link'

export type CuratedHomeComment = {
  id: string
  body: string
  modelId: string
  modelTitle: string
  userDisplayName: string
  userProfileSlug: string | null
  userAvatarUrl: string | null
  imageUrl: string | null
  imageStatus: string | null
}

type CuratedHomeCommentsProps = {
  comments: CuratedHomeComment[]
}

export function CuratedHomeComments({ comments }: CuratedHomeCommentsProps) {
  if (comments.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-brand-300/80">Community</p>
          <h2 className="text-xl font-semibold mt-1">Curated model comments</h2>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {comments.map((comment) => {
          const imageUrl = comment.imageStatus !== 'failed' ? comment.imageUrl : null
          return (
            <article key={comment.id} className="glass rounded-xl border border-white/10 p-4 space-y-3">
              <div className="flex items-center gap-3">
                {comment.userAvatarUrl ? (
                  <img
                    src={comment.userAvatarUrl}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover border border-white/10"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center text-xs font-semibold border border-white/10">
                    {(comment.userDisplayName || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  {comment.userProfileSlug ? (
                    <Link href={`/u/${comment.userProfileSlug}`} className="block text-sm font-semibold truncate hover:underline">
                      {comment.userDisplayName}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold truncate">{comment.userDisplayName}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    on{' '}
                    <Link href={`/models/${comment.modelId}`} className="hover:text-white">
                      {comment.modelTitle}
                    </Link>
                  </p>
                </div>
              </div>
              {imageUrl ? (
                <Link href={`/models/${comment.modelId}`} className="block overflow-hidden rounded-md border border-white/10 bg-slate-950/60">
                  <img
                    src={imageUrl}
                    alt={`${comment.modelTitle} community make`}
                    className="h-24 w-full object-cover transition duration-200 hover:scale-[1.02]"
                    loading="lazy"
                  />
                </Link>
              ) : null}
              <p className="text-sm text-slate-200 line-clamp-4 whitespace-pre-wrap">{comment.body}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
