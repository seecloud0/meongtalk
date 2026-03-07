import { useState, useRef } from 'react';

export default function UploadArea({ onImageUpload }) {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            handleFile(file);
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = (file) => {
        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 올려주세요! 🐶');
            return;
        }

        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        onImageUpload(file, previewUrl);
    };

    return (
        <div
            className={`upload-zone ${isDragging ? 'drag-active' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleClick}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
            />
            <span className="upload-icon">📸</span>
            <h3 style={{ color: 'var(--color-primary)', marginBottom: '8px' }} className="font-cute">
                우리 댕댕이 사진 올리기
            </h3>
            <p style={{ color: 'var(--color-text-mutted)', fontSize: '0.9rem' }}>
                클릭하거나 사진을 이곳으로 끌어오세요!
            </p>
        </div>
    );
}
