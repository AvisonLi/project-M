import React, { useState } from 'react';
import './GradeUploadPanel.css';

function GradeUploadPanel({ assessments, onUpload, uploading }) {
  const [assessmentId, setAssessmentId] = useState('');
  const [csvFile, setCsvFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assessmentId || !csvFile) return;

    await onUpload(assessmentId, csvFile);
    setCsvFile(null);
  };

  return (
    <div className="grade-upload-section">
      <h3>CSV Grade Upload</h3>
      <p className="upload-hint">CSV must include either `student_id` or `email`, plus `score` (`feedback` is optional).</p>

      <form className="grade-upload-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Select Assessment</label>
            <select
              value={assessmentId}
              onChange={(e) => setAssessmentId(e.target.value)}
              required
            >
              <option value="">-- Choose assessment --</option>
              {assessments.map((assessment) => (
                <option key={assessment.id} value={assessment.id}>
                  {assessment.title} ({assessment.type})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Upload CSV File</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="submit-btn"
          disabled={uploading || !assessmentId || !csvFile}
        >
          {uploading ? 'Uploading...' : 'Upload Grades CSV'}
        </button>
      </form>
    </div>
  );
}

export default GradeUploadPanel;
