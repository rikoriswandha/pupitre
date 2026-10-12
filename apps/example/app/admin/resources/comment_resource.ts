import { action, actions, defineResource, pages, schema, table, t } from '@rikology/pupitre'
import Comment from '#models/comment'
import { rating, ratingColumn, ratingEntry } from '../extensions/rating.js'

const rateComment = action('rate-comment')
  .label(t('Rate comment'))
  .icon('star')
  .modalHeading(t('Rate comment'))
  .modalSubmitLabel(t('Save rating'))
  .form([rating('rating').label(t('Rating')).stars(5).required()])
  .fillForm(({ record }) => ({ rating: (record as Comment).rating }))
  .handle(async ({ record, data, notify }) => {
    const comment = record as Comment
    comment.rating = Number(data?.rating)
    await comment.save()
    notify?.success(t('Rating saved')).send()
  })
  .after(({ refresh }) => refresh.table())

export default defineResource(Comment)
  .slug('comments')
  .label(t('Comment'))
  .pluralLabel(t('Comments'))
  .recordTitle('title')
  .form(() => [
    schema.text('title').label(t('Title')),
    schema.text('body').label(t('Body')),
    schema.select('postId').label(t('Post')).relationship('post', 'title'),
    rating('rating')
      .label(t('Rating'))
      .stars(5)
      .default(0)
      .required()
      .helperText(t('Use arrow keys to choose a rating, or clear it with No rating.')),
    schema
      .repeater('ratingDetails')
      .label(t('Rating criteria'))
      .default([])
      .schema([
        schema.text('criterion').label(t('Criterion')).required(),
        rating('score').label(t('Criterion rating')).stars(5).default(0).required(),
      ])
      .addLabel(t('Add criterion')),
  ])
  .table((builder) =>
    builder.columns([
      table.text('title').label(t('Title')).searchable().sortable(),
      table.text('body').label(t('Body')).searchable().sortable(),
      table.text('post.title').label(t('Post')).sortable(),
      ratingColumn('rating').label(t('Rating')).stars(5).sortable(),
    ])
  )
  .infolist(() => [
    schema.textEntry('title').label(t('Title')),
    schema.textEntry('body').label(t('Body')),
    schema.textEntry('postId').label(t('Post Id')),
    ratingEntry('rating').label(t('Rating')).stars(5),
    schema
      .repeatableEntry('ratingDetails')
      .label(t('Rating criteria'))
      .schema([
        schema.textEntry('criterion').label(t('Criterion')),
        ratingEntry('score').label(t('Criterion rating')).stars(5),
      ]),
  ])
  .actions({
    header: [actions.create()],
    row: [rateComment, actions.edit(), actions.view(), actions.delete()],
  })
  .pages({
    list: pages.list(),
    create: pages.create(),
    edit: pages.edit(),
    view: pages.view(),
  })
