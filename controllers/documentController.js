exports.getUploadPage = (req, res) => {
    res.render('upload', {
        pageTitle: 'Tải lên & Tóm tắt',
    });
};
