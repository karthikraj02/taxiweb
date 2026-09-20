const { resolveDbName } = require('../../config/db');

describe('resolveDbName', () => {
  it('defaults to taxiweb when an Atlas URI names no database', () => {
    expect(resolveDbName('mongodb+srv://u:p@cluster0.abc.mongodb.net/?retryWrites=true&w=majority', '')).toBe('taxiweb');
    expect(resolveDbName('mongodb+srv://u:p@cluster0.abc.mongodb.net', '')).toBe('taxiweb');
    expect(resolveDbName('mongodb+srv://u:p@cluster0.abc.mongodb.net/?appName=x', '')).toBe('taxiweb');
  });

  it('leaves a database named in the URI alone', () => {
    expect(resolveDbName('mongodb+srv://u:p@c.mongodb.net/mydb?retryWrites=true', '')).toBeUndefined();
    expect(resolveDbName('mongodb://localhost:27017/taxiweb', '')).toBeUndefined();
    expect(resolveDbName('mongodb://h1:27017,h2:27017/appdb?replicaSet=rs', '')).toBeUndefined();
  });

  it('lets MONGODB_DB override everything', () => {
    expect(resolveDbName('mongodb+srv://u:p@c.mongodb.net/mydb', 'other')).toBe('other');
    expect(resolveDbName('mongodb+srv://u:p@c.mongodb.net/', 'other')).toBe('other');
  });

  it('handles a missing uri without throwing', () => {
    expect(resolveDbName(undefined, '')).toBe('taxiweb');
  });
});
