import { expect, it,describe } from 'vitest';
import { getFileExtension } from '../../src/utils/upload';

describe('getFileExtension', () => {
    it('should return extension for supported file types', () => {
        expect(getFileExtension('https://example.com/image.jpg')).toBe('jpg');
        expect(getFileExtension('https://example.com/video.mp4')).toBe('mp4');
        expect(getFileExtension('https://video.weibo.com/media/play?livephoto=https%3A%2F%2Flivephoto.us.sinaimg.cn%2F00144a9ogx08kOWBvpbV0f0f0100jv350k01.mov')).toBe('mov');
    });

    it('should handle URLs with query parameters', () => {
        expect(getFileExtension('https://f.video.weibocdn.com/o0/mpDUPrFelx08fT18OHK001041200cziO0E010.mp4?label=mp4_hd&template=852x480.25.0&ori=0&ps=1BThihd3VLAY5R&Expires=1737188612&ssig=d43cWIbr7m&KID=unistore,video')).toBe('mp4');
    });

    it('should handle invalid URLs by returning filename or extension', () => {
        const result = getFileExtension('invalid-url');
        expect(result).toBe(''); // Since getFileExtension will return empty string for invalid URL
    });
});
